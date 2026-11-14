using Ampara.Application.Chaveiros;

namespace Ampara.Api.Endpoints;

public static class ChaveiroEndpoints
{
    public sealed record ChaveiroNovo(string? DeviceId);
    public sealed record ComandoNovo(string? Cmd);

    public static IEndpointRouteBuilder MapChaveiros(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/chaveiros").WithTags("Chaveiros").RequireAuthorization("Usuario");

        g.MapPost("", async (ChaveiroNovo n, HttpContext http, IChaveiroService svc, CancellationToken ct) =>
        {
            var id = await svc.ParearAsync(http.User.ToAtor().UsuarioId, n.DeviceId ?? "", ct);
            return Results.Created($"/api/v1/chaveiros/{n.DeviceId}", new { id, deviceId = n.DeviceId });
        });

        g.MapGet("", async (HttpContext http, IChaveiroService svc, CancellationToken ct) =>
            Results.Ok((await svc.ListarAsync(http.User.ToAtor().UsuarioId, ct))
                .Select(c => new { deviceId = c.DeviceId, online = c.Online, bateria = c.Bateria, vistoEm = c.VistoEm })));

        g.MapPost("{deviceId}/comandos", async (string deviceId, ComandoNovo n, HttpContext http, IChaveiroService svc, CancellationToken ct) =>
        {
            await svc.EnviarComandoAsync(http.User.ToAtor().UsuarioId, deviceId, n.Cmd ?? "", ct);
            return Results.Accepted();
        });

        return rotas;
    }
}
