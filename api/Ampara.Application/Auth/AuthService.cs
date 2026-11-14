using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Auth;

public sealed class AuthService(IAmparaDb db, ISenhaHasher hasher, ITokenService tokens, TimeProvider tempo) : IAuthService
{
    public static readonly TimeSpan ValidadeLogin = TimeSpan.FromHours(8);
    private const int SenhaMinima = 8;

    // Hash usado para gastar o mesmo tempo quando o e-mail não existe (sem enumeração por tempo).
    private static string? _hashFalso;

    public static string NormalizarEmail(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public async Task<Guid> RegistrarAsync(string nome, string email, string senha, CancellationToken ct)
    {
        nome = (nome ?? "").Trim();
        var emailNorm = NormalizarEmail(email);
        if (nome.Length == 0) throw new DominioException("nome-obrigatorio");
        if (emailNorm.Length == 0 || !emailNorm.Contains('@')) throw new DominioException("email-invalido");
        if ((senha ?? "").Length < SenhaMinima) throw new DominioException("senha-curta");

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
}
