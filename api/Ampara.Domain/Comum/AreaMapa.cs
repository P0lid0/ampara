using System.Globalization;

namespace Ampara.Domain.Comum;

/// <summary>Grade de ~500 m do contrato (mesma função em C# e Python). Limites superiores exclusivos.</summary>
public static class AreaMapa
{
    private const double LatMin = -23.80, LatMax = -23.35, LngMin = -46.83, LngMax = -46.36;
    private const double PassoLat = 0.0045, PassoLng = 0.0049;
    public const string Fora = "fora";

    public static string AreaId(double lat, double lng)
    {
        if (double.IsNaN(lat) || double.IsNaN(lng) || lat < LatMin || lat >= LatMax || lng < LngMin || lng >= LngMax)
            return Fora;
        var linha = (int)Math.Floor((lat - LatMin) / PassoLat);
        var coluna = (int)Math.Floor((lng - LngMin) / PassoLng);
        return $"g{linha:000}_{coluna:000}";
    }

    public static (double Lat, double Lng)? Centro(string areaId)
    {
        if (areaId is null || areaId.Length < 6 || areaId[0] != 'g') return null;
        var partes = areaId[1..].Split('_');
        if (partes.Length != 2
            || !int.TryParse(partes[0], NumberStyles.None, CultureInfo.InvariantCulture, out var linha)
            || !int.TryParse(partes[1], NumberStyles.None, CultureInfo.InvariantCulture, out var coluna))
            return null;
        return (LatMin + (linha + 0.5) * PassoLat, LngMin + (coluna + 0.5) * PassoLng);
    }

    private static DateTime Local(DateTime utc)
    {
        var u = utc.Kind == DateTimeKind.Local ? utc.ToUniversalTime() : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTimeFromUtc(u, FusoBrasil.SaoPaulo);
    }

    /// <summary>8 faixas de 3 h em hora local de São Paulo.</summary>
    public static int Faixa(DateTime utc) => Local(utc).Hour / 3;

    /// <summary>0 = segunda ... 6 = domingo, em hora local de São Paulo.</summary>
    public static int DiaSemana(DateTime utc) => ((int)Local(utc).DayOfWeek + 6) % 7;
}
