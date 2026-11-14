using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Ampara.Api.Hubs;

/// <summary>Só servidor→cliente: sem métodos invocáveis pelo cliente. Cada conexão entra no grupo g-{usuarioId}.</summary>
[Authorize(Policy = "Usuario")]
public sealed class GuardiaoHub : Hub
{
    public static string Grupo(Guid usuarioId) => $"g-{usuarioId}";

    public override async Task OnConnectedAsync()
    {
        if (Guid.TryParse(Context.User?.FindFirst("sub")?.Value, out var id))
            await Groups.AddToGroupAsync(Context.ConnectionId, Grupo(id));
        else
            { Context.Abort(); return; }
        await base.OnConnectedAsync();
    }
}
