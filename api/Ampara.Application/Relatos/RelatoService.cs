using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Application.Risco;
using Ampara.Domain.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Relatos;

public sealed class RelatoService(IAmparaDb db, TimeProvider tempo, IRiscoService risco, IModeradorRelato moderador) : IRelatoService
{
    public const int MaxLista = 200;
    public const int MaxPorHora = 5;
    public const int MaxTexto = 500;
    public static readonly TimeSpan Validade = TimeSpan.FromHours(2);
    private static readonly TimeSpan ToleranciaFuturo = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan JanelaLimite = TimeSpan.FromHours(1);

    public async Task<Guid> CriarAsync(Guid autorId, RelatoEntrada e, CancellationToken ct)
    {
        if (e is null || !Enum.IsDefined(e.Tipo) || e.Texto is { Length: > MaxTexto }) throw new DominioException("relato-invalido");
        if (!double.IsFinite(e.Lat) || !double.IsFinite(e.Lng)) throw new DominioException("relato-fora-do-mapa");
        var areaId = AreaMapa.AreaId(e.Lat, e.Lng);
        if (areaId == AreaMapa.Fora) throw new DominioException("relato-fora-do-mapa");

        var agora = tempo.GetUtcNow().UtcDateTime;
        var em = e.Em.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(e.Em, DateTimeKind.Utc) : e.Em.ToUniversalTime();
        if (em > agora + ToleranciaFuturo || em < agora - Validade) throw new DominioException("relato-fora-da-janela");

        // Moderacao antes de gravar: relato-abusivo barra; o texto aprovado (ou null) e o que fica.
        string? texto = null;
        if (!string.IsNullOrWhiteSpace(e.Texto)) texto = await moderador.ModerarTextoAsync(e.Texto, ct);

        return await db.TransacaoAsync(async () =>
        {
            await db.TravarPorChaveAsync($"relato:{autorId}", ct);   // serializa o limite por usuario no PostgreSQL
            var desde = agora - JanelaLimite;
            var recentes = await db.Relatos.AsNoTracking()
                .Where(r => r.AutorId == autorId && r.CriadoEm > desde)
                .Select(r => r.CriadoEm).ToListAsync(ct);
            if (recentes.Count >= MaxPorHora)
            {
                var libera = recentes.Min() + JanelaLimite - agora;
                throw new LimiteExcedidoException("limite-relatos", libera > TimeSpan.Zero ? libera : TimeSpan.FromSeconds(1));
            }

            var relato = Relato.Criar(autorId, e.Tipo, e.Lat, e.Lng, areaId, em, agora, texto);
            db.Relatos.Add(relato);
            db.RelatoConfirmacoes.Add(RelatoConfirmacao.Criar(relato.Id, autorId, agora));   // o autor e a 1a confirmacao
            await db.SaveChangesAsync(ct);
            return relato.Id;
        }, ct);
    }

    public async Task ConfirmarAsync(Guid usuarioId, Guid relatoId, CancellationToken ct)
    {
        var agora = tempo.GetUtcNow().UtcDateTime;
        var limite = agora - Validade;
        var existe = await db.Relatos.AsNoTracking().AnyAsync(r => r.Id == relatoId && r.Em > limite, ct);
        if (!existe) throw new NaoEncontradoException("relato-nao-encontrado");

        if (await db.RelatoConfirmacoes.AsNoTracking().AnyAsync(c => c.RelatoId == relatoId && c.UsuarioId == usuarioId, ct)) return;
        db.RelatoConfirmacoes.Add(RelatoConfirmacao.Criar(relatoId, usuarioId, agora));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Corrida com a mesma confirmacao: o indice unico barrou. Se ela ja existe, e o caso benigno.
            db.LimparRastreamento();
            if (await db.RelatoConfirmacoes.AsNoTracking().AnyAsync(c => c.RelatoId == relatoId && c.UsuarioId == usuarioId, ct)) return;
            throw;
        }
    }

    public async Task<IReadOnlyList<RelatoDto>> ListarVisiveisAsync(double minLat, double minLng, double maxLat, double maxLng, CancellationToken ct)
    {
        var agora = tempo.GetUtcNow().UtcDateTime;
        var limite = agora - Validade;
        var candidatos = await db.Relatos.AsNoTracking()
            .Where(r => r.Em > limite && r.Lat >= minLat && r.Lat <= maxLat && r.Lng >= minLng && r.Lng <= maxLng)
            .Select(r => new { r.Id, r.Tipo, r.Lat, r.Lng, r.Em, r.AreaId, Confirmacoes = db.RelatoConfirmacoes.Count(c => c.RelatoId == r.Id) })
            .ToListAsync(ct);

        var dia = AreaMapa.DiaSemana(agora);
        var faixa = AreaMapa.Faixa(agora);
        // Cache por area: varios relatos na mesma celula consultam o risco uma vez.
        var alto = new Dictionary<string, bool>();
        bool AreaAlta(string area)
        {
            if (!alto.TryGetValue(area, out var v)) alto[area] = v = risco.ClasseDe(area, dia, faixa) == "alto";
            return v;
        }

        // Ordena em memoria: o SQLite dos testes nao ordena data UTC de forma confiavel no servidor.
        return candidatos
            .Where(r => r.Confirmacoes >= 2 || AreaAlta(r.AreaId))
            .OrderByDescending(r => r.Em).ThenBy(r => r.Id)
            .Take(MaxLista)
            .Select(r => new RelatoDto(r.Id, r.Tipo.ToString().ToLowerInvariant(), r.Lat, r.Lng, DateTime.SpecifyKind(r.Em, DateTimeKind.Utc), r.Confirmacoes))
            .ToList();
    }

    public async Task<int> PurgarExpiradosAsync(CancellationToken ct)
    {
        var limite = tempo.GetUtcNow().UtcDateTime - Validade;
        var vencidos = await db.Relatos.Where(r => r.Em < limite).ToListAsync(ct);
        if (vencidos.Count == 0) return 0;
        var ids = vencidos.Select(r => r.Id).ToList();
        // Remove as confirmacoes explicitamente: nao depende da cascata do provedor.
        db.RelatoConfirmacoes.RemoveRange(await db.RelatoConfirmacoes.Where(c => ids.Contains(c.RelatoId)).ToListAsync(ct));
        db.Relatos.RemoveRange(vencidos);
        await db.SaveChangesAsync(ct);
        return vencidos.Count;
    }
}
