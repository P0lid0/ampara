using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;

namespace Ampara.Api.Endpoints;

public static class SaudeEndpoints
{
    /// <summary>GET /health na raiz (fora de /api/v1), anônimo. Banco fora = 503; MQTT fora = 200 "degradado".</summary>
    public static IEndpointRouteBuilder MapSaude(this IEndpointRouteBuilder rotas)
    {
        rotas.MapGet("/health", async (IChaveiroGateway gateway, ISondaSaude sonda, CancellationToken ct) =>
        {
            var mqtt = gateway.Conectado;
            var db = await sonda.BancoOkAsync(ct);
            if (!db) return Results.Json(new { status = "falha", mqtt, db = false }, statusCode: StatusCodes.Status503ServiceUnavailable);
            return Results.Ok(new { status = mqtt ? "ok" : "degradado", mqtt, db = true });
        }).AllowAnonymous().WithTags("Saude");
        return rotas;
    }
}
