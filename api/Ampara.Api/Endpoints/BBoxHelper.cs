using System.Globalization;
using Ampara.Application.Comum;

namespace Ampara.Api.Endpoints;

/// <summary>Leitura compartilhada da bbox (minLat, minLng, maxLat, maxLng) das rotas de mapa.</summary>
public static class BBoxHelper
{
    public static (double MinLat, double MinLng, double MaxLat, double MaxLng) Ler(
        string? minLat, string? minLng, string? maxLat, string? maxLng, string codigoErro)
    {
        if (!Coord(minLat, out var a) || !Coord(minLng, out var b) || !Coord(maxLat, out var c) || !Coord(maxLng, out var d) || a >= c || b >= d)
            throw new DominioException(codigoErro);
        return (a, b, c, d);
    }

    private static bool Coord(string? s, out double v) =>
        double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v) && double.IsFinite(v);
}
