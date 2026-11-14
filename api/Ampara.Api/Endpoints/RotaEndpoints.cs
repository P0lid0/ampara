using Ampara.Application.Comum;
using Ampara.Application.Rota;

namespace Ampara.Api.Endpoints;

public static class RotaEndpoints
{
    public sealed record PontoNovo(double? Lat, double? Lng, double? Precisao, DateTime? Em);

    public static IEndpointRouteBuilder MapRota(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/rota").WithTags("Rota");

        g.MapPost("/pontos", async (PontoNovo[]? lote, HttpContext http, IRotaService svc, CancellationToken ct) =>
        {
            var entradas = (lote ?? [])
                .Select(p => p is { Lat: { } lat, Lng: { } lng, Em: { } em }
                    ? new PontoRotaEntrada(lat, lng, p.Precisao, em)
                    : throw new DominioException("ponto-invalido"))
                .ToList();
            await svc.RegistrarLoteAsync(http.User.ToAtor().UsuarioId, entradas, ct);
            return Results.Accepted();
        }).RequireAuthorization("Usuario");

        g.MapGet("", async (DateTime? de, DateTime? ate, HttpContext http, IRotaService svc, CancellationToken ct) =>
            Results.Ok(await svc.ConsultarAsync(http.User.ToAtor(), de, ate, ct))).RequireAuthorization("UsuarioOuEmergencia");

        return rotas;
    }
}
