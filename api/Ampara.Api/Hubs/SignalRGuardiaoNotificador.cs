using Ampara.Application.Alertas;
using Microsoft.AspNetCore.SignalR;

namespace Ampara.Api.Hubs;

public sealed class SignalRGuardiaoNotificador(IHubContext<GuardiaoHub> hub) : IGuardiaoNotificador
{
    public Task AlertaDisparadoAsync(Guid guardiaoUsuarioId, AlertaDisparadoMsg m, CancellationToken ct) =>
        Enviar([guardiaoUsuarioId], "AlertaDisparado", m, ct);

    public Task AlertaEscaladoAsync(IEnumerable<Guid> guardioesUsuarioIds, AlertaEscaladoMsg m, CancellationToken ct) =>
        Enviar(guardioesUsuarioIds, "AlertaEscalado", m, ct);

    public Task AlertaEncerradoAsync(Guid guardiaoUsuarioId, AlertaEncerradoMsg m, CancellationToken ct) =>
        Enviar([guardiaoUsuarioId], "AlertaEncerrado", m, ct);

    public Task PassoAtualizadoAsync(IEnumerable<Guid> guardioesUsuarioIds, PassoAtualizadoMsg m, CancellationToken ct) =>
        Enviar(guardioesUsuarioIds, "PassoAtualizado", m, ct);

    private Task Enviar(IEnumerable<Guid> ids, string evento, object msg, CancellationToken ct)
    {
        var grupos = ids.Distinct().Select(GuardiaoHub.Grupo).ToList();
        return grupos.Count == 0 ? Task.CompletedTask : hub.Clients.Groups(grupos).SendAsync(evento, msg, ct);
    }
}
