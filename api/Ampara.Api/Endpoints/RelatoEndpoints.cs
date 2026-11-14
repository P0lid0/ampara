using Ampara.Application.Comum;
using Ampara.Application.Relatos;
using Ampara.Domain;

namespace Ampara.Api.Endpoints;

public static class RelatoEndpoints
{
    public sealed record RelatoNovo(string? Tipo, double? Lat, double? Lng, DateTime? Em, string? Texto);

    public static IEndpointRouteBuilder MapRelatos(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/relatos").WithTags("Relatos").RequireAuthorization("Usuario");

        g.MapPost("", async (RelatoNovo? corpo, HttpContext http, IRelatoService svc, CancellationToken ct) =>
        {
            if (corpo is not { Lat: { } lat, Lng: { } lng, Em: { } em } || !TentarTipo(corpo.Tipo, out var tipo))
                throw new DominioException("relato-invalido");
            var id = await svc.CriarAsync(http.User.ToAtor().UsuarioId, new RelatoEntrada(tipo, lat, lng, em, corpo.Texto), ct);
            return Results.Created($"/api/v1/relatos/{id}", new { relatoId = id });
        });

        g.MapPost("/{id:guid}/confirmar", async (Guid id, HttpContext http, IRelatoService svc, CancellationToken ct) =>
        {
            await svc.ConfirmarAsync(http.User.ToAtor().UsuarioId, id, ct);
            return Results.NoContent();
        });

        g.MapGet("", async (string? minLat, string? minLng, string? maxLat, string? maxLng, IRelatoService svc, CancellationToken ct) =>
        {
            var (a, b, c, d) = BBoxHelper.Ler(minLat, minLng, maxLat, maxLng, "relato-bbox-invalido");
            return Results.Ok(await svc.ListarVisiveisAsync(a, b, c, d, ct));
        });

        return rotas;
    }

    private static bool TentarTipo(string? s, out TipoRelato tipo)
    {
        tipo = default;
        // So os tres nomes do contrato, em minusculas (nada de numero nem variacao de caixa).
        switch (s)
        {
            case "roubo": tipo = TipoRelato.Roubo; return true;
            case "furto": tipo = TipoRelato.Furto; return true;
            case "suspeita": tipo = TipoRelato.Suspeita; return true;
            default: return false;
        }
    }
}
