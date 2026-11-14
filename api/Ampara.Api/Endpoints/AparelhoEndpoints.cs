using Ampara.Application.Aparelhos;

namespace Ampara.Api.Endpoints;

public static class AparelhoEndpoints
{
    public sealed record AparelhoNovo(string? Imei, string? Marca, string? Modelo);

    public static IEndpointRouteBuilder MapAparelhos(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/aparelhos").WithTags("Aparelhos").RequireAuthorization("Usuario");

        g.MapPost("", async (AparelhoNovo n, HttpContext http, IAparelhoService svc, CancellationToken ct) =>
        {
            var r = await svc.CriarAsync(http.User.ToAtor().UsuarioId, n.Imei ?? "", n.Marca ?? "", n.Modelo ?? "", ct);
            return Results.Created($"/api/v1/aparelhos/{r.AparelhoId}", new { aparelhoId = r.AparelhoId, imeiFinal = r.ImeiFinal });
        });

        g.MapGet("", async (HttpContext http, IAparelhoService svc, CancellationToken ct) =>
            Results.Ok((await svc.ListarAsync(http.User.ToAtor().UsuarioId, ct))
                .Select(a => new { id = a.Id, marca = a.Marca, modelo = a.Modelo, imeiMascarado = a.ImeiMascarado })));

        return rotas;
    }
}
