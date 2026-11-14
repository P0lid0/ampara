using Ampara.Application.Alertas;

namespace Ampara.Api.Endpoints;

public static class AlertaEndpoints
{
    public static IEndpointRouteBuilder MapAlertas(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/alertas").WithTags("Alertas").RequireAuthorization("Usuario");

        g.MapGet("ativos", async (HttpContext http, IEscalonamento esc, CancellationToken ct) =>
            Results.Ok(await esc.AtivosAsync(http.User.ToAtor().UsuarioId, ct)));

        g.MapPost("{id:guid}/ciente", async (Guid id, HttpContext http, IEscalonamento esc, CancellationToken ct) =>
        {
            await esc.ConfirmarCienteAsync(http.User.ToAtor(), id, ct);
            return Results.NoContent();
        });

        return rotas;
    }
}
