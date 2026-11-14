using System.Globalization;
using Ampara.Application.Comum;
using Ampara.Application.Risco;
using Ampara.Domain.Comum;

namespace Ampara.Api.Endpoints;

public static class RiscoEndpoints
{
    public static IEndpointRouteBuilder MapRisco(this IEndpointRouteBuilder rotas)
    {
        // Pública: só célula, classe e probabilidade agregadas; nada de dado pessoal.
        rotas.MapGet("/api/v1/risco", (string? minLat, string? minLng, string? maxLat, string? maxLng, string? dia, string? faixa,
            IRiscoService risco, TimeProvider tempo) =>
        {
            if (!Coord(minLat, out var a) || !Coord(minLng, out var b) || !Coord(maxLat, out var c) || !Coord(maxLng, out var d) || a >= c || b >= d)
                throw new DominioException("risco-bbox-invalido");
            var agora = tempo.GetUtcNow().UtcDateTime;
            var di = Indice(dia, 6, AreaMapa.DiaSemana(agora), "risco-dia-invalido");
            var fa = Indice(faixa, 7, AreaMapa.Faixa(agora), "risco-faixa-invalida");
            return Results.Ok(risco.Consultar(a, b, c, d, di, fa));   // record com Web defaults: camelCase
        }).WithTags("Risco").AllowAnonymous();
        return rotas;
    }

    private static bool Coord(string? s, out double v) =>
        double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v) && double.IsFinite(v);

    private static int Indice(string? s, int max, int padrao, string codigo)
    {
        if (string.IsNullOrEmpty(s)) return padrao;
        if (!int.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out var v) || v > max) throw new DominioException(codigo);
        return v;
    }
}
