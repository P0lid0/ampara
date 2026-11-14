using Ampara.Application.Policia;

namespace Ampara.Api.Endpoints;

public static class PoliciaEndpoints
{
    public static IEndpointRouteBuilder MapPolicia(this IEndpointRouteBuilder rotas)
    {
        rotas.MapPost("/api/v1/ocorrencias/{id:guid}/compartilhar-policia", async (Guid id, CompartilharEntrada? corpo, HttpContext http, IPoliciaService svc, CancellationToken ct) =>
            Results.Ok(new { protocolo = await svc.CompartilharAsync(http.User.ToAtor(), id, corpo?.Consentimento == true, ct) }))
            .WithTags("Polícia").RequireAuthorization("UsuarioOuEmergencia");

        rotas.MapGet("/api/v1/ocorrencias/{id:guid}/retorno", async (Guid id, HttpContext http, IPoliciaService svc, CancellationToken ct) =>
            Results.Ok(await svc.RetornoAsync(http.User.ToAtor(), id, ct)))
            .WithTags("Polícia").RequireAuthorization("UsuarioOuEmergencia");

        rotas.MapPut("/api/v1/ocorrencias/{id:guid}/acompanhamento", async (Guid id, AcompanhamentoEntrada? corpo, HttpContext http, IPoliciaService svc, CancellationToken ct) =>
        {
            await svc.DefinirAcompanhamentoAsync(http.User.ToAtor(), id, corpo!, ct);
            return Results.NoContent();
        }).WithTags("Polícia").RequireAuthorization("UsuarioOuEmergencia");
        return rotas;
    }
}
