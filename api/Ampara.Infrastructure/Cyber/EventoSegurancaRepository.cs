using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Infrastructure.Cyber;

public sealed class EventoSegurancaRepository(AmparaDbContext db) : IEventoSegurancaRepository
{
    public async Task AdicionarAsync(EventoSeguranca e, CancellationToken ct = default)
    {
        db.EventosSeguranca.Add(e);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<EventoSeguranca>> DesdeAsync(DateTimeOffset desde, Guid? usuarioAlvoId, CancellationToken ct = default)
    {
        var q = db.EventosSeguranca.AsNoTracking().Where(e => e.Em >= desde);
        if (usuarioAlvoId is { } u) q = q.Where(e => e.UsuarioAlvoId == u);
        return await q.OrderBy(e => e.Em).ToListAsync(ct);
    }
}
