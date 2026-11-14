namespace Ampara.Domain.Comum;

public static class FusoBrasil
{
    public static TimeZoneInfo SaoPaulo { get; } = Resolver();

    private static TimeZoneInfo Resolver()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time"); }
    }
}
