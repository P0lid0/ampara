using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Auth;

public sealed class AuthService(IAmparaDb db, ISenhaHasher hasher, ITokenService tokens, TimeProvider tempo, IAcessoIndevido acessoIndevido) : IAuthService
{
    public static readonly TimeSpan ValidadeLogin = TimeSpan.FromHours(8);
    private const int SenhaMinima = 8;
    private const int SenhaMaxima = 256;
    private const int NomeMaximo = 200;
    private const int EmailMaximo = 320;

    public static readonly TimeSpan ValidadeEmergencia = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan JanelaEmergencia = TimeSpan.FromMinutes(15);
    public const int ErrosParaBloquear = 5;
    private const int CodigoMinimo = 6;
    private const int CodigoMaximo = 10;
    private const int PalavraMinima = 4;
    private const int PalavraMaxima = 100;

    // Hash usado para gastar o mesmo tempo quando o e-mail não existe (sem enumeração por tempo).
    private static string? _hashFalso;
    private static string? _hashFalsoEmergencia;

    public static string NormalizarEmail(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public async Task<Guid> RegistrarAsync(string nome, string email, string senha, CancellationToken ct)
    {
        nome = (nome ?? "").Trim();
        var emailNorm = NormalizarEmail(email);
        if (nome.Length == 0) throw new DominioException("nome-obrigatorio");
        if (nome.Length > NomeMaximo) throw new DominioException("nome-longo");
        if (emailNorm.Length == 0 || emailNorm.Length > EmailMaximo || !emailNorm.Contains('@')) throw new DominioException("email-invalido");
        if ((senha ?? "").Length < SenhaMinima) throw new DominioException("senha-curta");
        if (senha!.Length > SenhaMaxima) throw new DominioException("senha-longa");

        if (await db.Usuarios.AnyAsync(u => u.Email == emailNorm, ct)) throw new ConflitoException("email-ja-cadastrado");

        var usuario = Usuario.Criar(nome, emailNorm, hasher.Hash(senha), tempo.GetUtcNow().UtcDateTime);
        db.Usuarios.Add(usuario);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Corrida: outro registro com o mesmo e-mail passou entre a checagem e o INSERT (índice único).
            if (await db.Usuarios.AsNoTracking().AnyAsync(u => u.Email == emailNorm && u.Id != usuario.Id, ct))
                throw new ConflitoException("email-ja-cadastrado");
            throw;
        }
        return usuario.Id;
    }

    public async Task<TokenDto> LoginAsync(string email, string senha, CancellationToken ct)
    {
        var emailNorm = NormalizarEmail(email);
        var usuario = await db.Usuarios.AsNoTracking().SingleOrDefaultAsync(u => u.Email == emailNorm, ct);
        if (usuario is null)
        {
            _hashFalso ??= hasher.Hash("senha-falsa-para-igualar-o-tempo");
            hasher.Verificar(senha ?? "", _hashFalso);
            throw new NaoAutenticadoException("credenciais-invalidas");
        }
        if (!hasher.Verificar(senha ?? "", usuario.SenhaHash)) throw new NaoAutenticadoException("credenciais-invalidas");
        return tokens.Emitir(usuario.Id, usuario.Papel, Escopos.Usuario, ValidadeLogin);
    }

    public async Task DefinirEmergenciaAsync(Guid usuarioId, string codigo, string palavraSecreta, CancellationToken ct)
    {
        codigo = (codigo ?? "").Trim();
        if (codigo.Length < CodigoMinimo || codigo.Length > CodigoMaximo || !codigo.All(char.IsAsciiDigit))
            throw new DominioException("codigo-emergencia-invalido");
        var palavra = NormalizarPalavra(palavraSecreta);
        if (palavra.Length < PalavraMinima || palavra.Length > PalavraMaxima) throw new DominioException("palavra-secreta-invalida");

        var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.Id == usuarioId, ct)
            ?? throw new NaoEncontradoException("usuario-nao-encontrado");
        usuario.DefinirEmergencia(hasher.Hash(codigo), hasher.Hash(palavra));
        await db.SaveChangesAsync(ct);
    }

    public async Task<TokenDto> LoginEmergenciaAsync(string email, string codigo, string palavraSecreta, CancellationToken ct)
    {
        var emailNorm = NormalizarEmail(email);
        if (emailNorm.Length > EmailMaximo) emailNorm = emailNorm[..EmailMaximo];
        var agora = tempo.GetUtcNow().UtcDateTime;
        var desde = agora - JanelaEmergencia;

        // So erros contam. Com 5 na janela, toda tentativa (inclusive a certa) e barrada e NAO e gravada,
        // para a janela poder passar.
        var errosRecentes = await db.TentativasEmergencia.AsNoTracking()
            .Where(t => t.EmailNormalizado == emailNorm && !t.Sucesso && t.Em > desde)
            .OrderByDescending(t => t.Em).Take(ErrosParaBloquear).Select(t => t.Em).ToListAsync(ct);
        if (errosRecentes.Count >= ErrosParaBloquear)
        {
            var libera = errosRecentes[^1] + JanelaEmergencia - agora;
            throw new LimiteExcedidoException("emergencia-bloqueada", libera > TimeSpan.Zero ? libera : TimeSpan.FromSeconds(1));
        }

        var usuario = await db.Usuarios.AsNoTracking().SingleOrDefaultAsync(u => u.Email == emailNorm, ct);
        _hashFalsoEmergencia ??= hasher.Hash("000000");
        var temConfig = usuario?.TemEmergenciaConfigurada == true;
        // Verifica sempre os dois hashes (tempo parecido para e-mail inexistente ou sem emergencia configurada).
        var codigoOk = hasher.Verificar((codigo ?? "").Trim(), temConfig ? usuario!.CodigoEmergenciaHash! : _hashFalsoEmergencia);
        var palavraOk = hasher.Verificar(NormalizarPalavra(palavraSecreta), temConfig ? usuario!.PalavraSecretaHash! : _hashFalsoEmergencia);

        if (!temConfig || !codigoOk || !palavraOk)
        {
            db.TentativasEmergencia.Add(TentativaEmergencia.Criar(emailNorm, agora, sucesso: false));
            await db.SaveChangesAsync(ct);
            acessoIndevido.Registrar(usuario?.Id, "codigo-emergencia");
            throw new NaoAutenticadoException("credenciais-invalidas");
        }

        db.TentativasEmergencia.Add(TentativaEmergencia.Criar(emailNorm, agora, sucesso: true));
        await db.SaveChangesAsync(ct);
        return tokens.Emitir(usuario!.Id, usuario.Papel, Escopos.Emergencia, ValidadeEmergencia);
    }

    private static string NormalizarPalavra(string? palavra) => (palavra ?? "").Trim().ToLowerInvariant();
}
