using System.Security.Cryptography;
using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Guardioes;

public sealed class GuardiaoService(IAmparaDb db, TimeProvider tempo) : IGuardiaoService
{
    public const string Alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    public const int TamanhoCodigo = 6;
    public const int Maximo = 3;

    private DateTime Agora => tempo.GetUtcNow().UtcDateTime;

    public async Task<ConviteDto> CriarConviteAsync(Guid usuarioId, CancellationToken ct) =>
        await db.TransacaoAsync(async () =>
        {
            await db.TravarPorChaveAsync("guardioes:" + usuarioId, ct);
            var agora = Agora;
            var guardioes = await db.Guardioes.CountAsync(g => g.UsuarioId == usuarioId, ct);
            // Datas comparadas em memória: o SQLite dos testes não compara data UTC de forma confiável no servidor.
            var pendentes = (await db.Convites.AsNoTracking().Where(c => c.UsuarioId == usuarioId && c.UsadoEm == null)
                .Select(c => c.ExpiraEm).ToListAsync(ct)).Count(e => e > agora);
            if (guardioes + pendentes >= Maximo) throw new ConflitoException("limite-guardioes");

            string codigo;
            var tentativas = 0;
            do
            {
                codigo = NovoCodigo();
                if (++tentativas > 10) throw new ConflitoException("codigo-indisponivel");
            } while (await db.Convites.AnyAsync(c => c.Codigo == codigo, ct));

            var convite = Convite.Criar(usuarioId, codigo, agora);
            db.Convites.Add(convite);
            await db.SaveChangesAsync(ct);
            return new ConviteDto(convite.Codigo, convite.ExpiraEm);
        }, ct);

    public async Task AceitarConviteAsync(Guid guardiaoUsuarioId, string codigo, CancellationToken ct)
    {
        codigo = (codigo ?? "").Trim().ToUpperInvariant();
        var vitimaId = await db.Convites.AsNoTracking().Where(c => c.Codigo == codigo).Select(c => (Guid?)c.UsuarioId).FirstOrDefaultAsync(ct)
            ?? throw new NaoEncontradoException("convite-invalido");

        await db.TransacaoAsync(async () =>
        {
            await db.TravarPorChaveAsync("guardioes:" + vitimaId, ct);
            // Relê dentro da trava: dois aceites simultâneos do mesmo código não passam juntos.
            var convite = await db.Convites.FirstOrDefaultAsync(c => c.Codigo == codigo, ct);
            if (convite is null || convite.UsadoEm is not null) throw new NaoEncontradoException("convite-invalido");
            if (convite.UsuarioId == guardiaoUsuarioId) throw new DominioException("convite-proprio");
            var agora = Agora;
            if (!convite.Valido(agora)) throw new RecursoVencidoException("convite-vencido");

            var atuais = await db.Guardioes.AsNoTracking().Where(g => g.UsuarioId == vitimaId)
                .Select(g => g.GuardiaoUsuarioId).ToListAsync(ct);
            if (atuais.Count >= Maximo) throw new ConflitoException("limite-guardioes");
            if (atuais.Contains(guardiaoUsuarioId)) throw new ConflitoException("guardiao-ja-vinculado");

            convite.Usar(agora);
            db.Guardioes.Add(new Guardiao
            {
                Id = Guid.NewGuid(),
                UsuarioId = vitimaId,
                GuardiaoUsuarioId = guardiaoUsuarioId,
                Ordem = atuais.Count + 1,
                CriadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
            });
            await db.SaveChangesAsync(ct);
            return true;
        }, ct);
    }

    public async Task<IReadOnlyList<GuardiaoDto>> ListarAsync(Guid usuarioId, CancellationToken ct)
    {
        var linhas = await (from g in db.Guardioes.AsNoTracking()
                            join u in db.Usuarios.AsNoTracking() on g.GuardiaoUsuarioId equals u.Id
                            where g.UsuarioId == usuarioId
                            select new { g.Id, u.Nome, g.Ordem }).ToListAsync(ct);
        return linhas.OrderBy(l => l.Ordem).Select(l => new GuardiaoDto(l.Id, l.Nome, l.Ordem)).ToList();
    }

    public async Task DefinirOrdemAsync(Guid usuarioId, IReadOnlyList<Guid> ordem, CancellationToken ct)
    {
        await db.TransacaoAsync(async () =>
        {
            await db.TravarPorChaveAsync("guardioes:" + usuarioId, ct);
            var atuais = await db.Guardioes.Where(g => g.UsuarioId == usuarioId).ToListAsync(ct);
            // Permutação exata: mesmos ids, sem repetição, no máximo 3.
            if (ordem is null || ordem.Count > Maximo || ordem.Count != atuais.Count
                || ordem.Distinct().Count() != ordem.Count
                || !ordem.All(id => atuais.Any(g => g.Id == id)))
                throw new DominioException("ordem-invalida");

            for (var i = 0; i < ordem.Count; i++) atuais.First(g => g.Id == ordem[i]).Ordem = i + 1;
            await db.SaveChangesAsync(ct);
            return true;
        }, ct);
    }

    public Task<bool> EhGuardiaoDeAsync(Guid guardiaoUsuarioId, Guid vitimaId, CancellationToken ct) =>
        db.Guardioes.AsNoTracking().AnyAsync(g => g.UsuarioId == vitimaId && g.GuardiaoUsuarioId == guardiaoUsuarioId, ct);

    private static string NovoCodigo() =>
        string.Create(TamanhoCodigo, 0, static (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = Alfabeto[RandomNumberGenerator.GetInt32(Alfabeto.Length)];
        });
}
