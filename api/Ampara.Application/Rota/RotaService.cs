using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Rota;

public sealed class RotaService(IAmparaDb db, TimeProvider tempo) : IRotaService
{
    public const int MaxLote = 500;
    public const int MaxConsulta = 20000;
    public static readonly TimeSpan Retencao = TimeSpan.FromDays(7);
    private static readonly TimeSpan ToleranciaFuturo = TimeSpan.FromMinutes(5);

    public async Task RegistrarLoteAsync(Guid usuarioId, IReadOnlyList<PontoRotaEntrada> pontos, CancellationToken ct)
    {
        var u = await db.Usuarios.AsNoTracking().Where(x => x.Id == usuarioId).Select(x => new { x.ConsentimentoRota }).SingleOrDefaultAsync(ct)
            ?? throw new NaoAutenticadoException("token-invalido");
        if (!u.ConsentimentoRota) throw new AcessoNegadoException("consentimento-ausente");
        if (pontos is null || pontos.Count == 0) return;
        if (pontos.Count > MaxLote) throw new DominioException("lote-grande");

        var agora = tempo.GetUtcNow().UtcDateTime;
        var limiteFuturo = agora + ToleranciaFuturo;
        var limitePassado = agora - Retencao;

        // Valida o lote inteiro antes de qualquer Add.
        var normalizados = new List<(PontoRotaEntrada P, DateTime Em)>(pontos.Count);
        foreach (var p in pontos)
        {
            if (p is null) throw new DominioException("ponto-invalido");
            var em = ParaUtc(p.Em);
            if (!double.IsFinite(p.Lat) || p.Lat < -90 || p.Lat > 90
                || !double.IsFinite(p.Lng) || p.Lng < -180 || p.Lng > 180
                || (p.Precisao is { } pr && (!double.IsFinite(pr) || pr < 0))
                || em > limiteFuturo || em < limitePassado)
                throw new DominioException("ponto-invalido");
            normalizados.Add((p, em));
        }

        var menor = normalizados.Min(x => x.Em);
        var maior = normalizados.Max(x => x.Em);
        var existentes = (await db.Pontos.AsNoTracking()
            .Where(x => x.UsuarioId == usuarioId && x.Em >= menor && x.Em <= maior)
            .Select(x => x.Em).ToListAsync(ct)).ToHashSet();

        foreach (var (p, em) in normalizados)
        {
            if (!existentes.Add(em)) continue;   // já gravado, ou repetido dentro do próprio lote
            db.Pontos.Add(PontoRota.Criar(usuarioId, p.Lat, p.Lng, p.Precisao, em));
        }
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Corrida com uma retransmissão simultânea: o índice único barrou. Se de fato todos os instantes do lote
            // já existem, é o caso benigno; qualquer outra falha sobe com a exceção original.
            var agoraExistem = (await db.Pontos.AsNoTracking()
                .Where(x => x.UsuarioId == usuarioId && x.Em >= menor && x.Em <= maior)
                .Select(x => x.Em).ToListAsync(ct)).ToHashSet();
            if (normalizados.All(x => agoraExistem.Contains(x.Em))) return;
            throw;
        }
    }

    public async Task<IReadOnlyList<PontoRotaDto>> ConsultarAsync(Ator ator, DateTime? de, DateTime? ate, CancellationToken ct)
    {
        var agora = tempo.GetUtcNow().UtcDateTime;
        var inicio = de.HasValue ? ParaUtc(de.Value) : agora - Retencao;
        var fim = ate.HasValue ? ParaUtc(ate.Value) : agora + ToleranciaFuturo;
        var linhas = await db.Pontos.AsNoTracking()
            .Where(p => p.UsuarioId == ator.UsuarioId && p.Em >= inicio && p.Em <= fim)
            .Select(p => new PontoRotaDto(p.Lat, p.Lng, p.Em))
            .ToListAsync(ct);
        // Ordena em memória: o SQLite dos testes não ordena data UTC de forma confiável no servidor.
        return linhas.OrderBy(p => p.Em).Take(MaxConsulta).ToList();
    }

    public async Task<int> PurgarExpiradosAsync(CancellationToken ct)
    {
        var limite = tempo.GetUtcNow().UtcDateTime - Retencao;
        var vencidos = await db.Pontos.Where(p => p.Em < limite).ToListAsync(ct);
        if (vencidos.Count == 0) return 0;
        db.Pontos.RemoveRange(vencidos);
        await db.SaveChangesAsync(ct);
        return vencidos.Count;
    }

    public async Task ApagarTudoAsync(Guid usuarioId, CancellationToken ct)
    {
        var todos = await db.Pontos.Where(p => p.UsuarioId == usuarioId).ToListAsync(ct);
        if (todos.Count == 0) return;
        db.Pontos.RemoveRange(todos);
        await db.SaveChangesAsync(ct);
    }

    private static DateTime ParaUtc(DateTime d) => d.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(d, DateTimeKind.Utc) : d.ToUniversalTime();
}
