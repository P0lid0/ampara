namespace Ampara.Domain.Comum;

public static class Imei
{
    /// <summary>Remove espaços e hífens.</summary>
    public static string Normalizar(string? s) =>
        string.IsNullOrEmpty(s) ? "" : s.Replace(" ", "").Replace("-", "");

    /// <summary>15 dígitos ASCII e dígito verificador de Luhn.</summary>
    public static bool Valido(string? s)
    {
        if (s is null || s.Length != 15) return false;
        var soma = 0;
        for (var i = 0; i < 15; i++)
        {
            var c = s[i];
            if (c < '0' || c > '9') return false;
            var d = c - '0';
            if (i % 2 == 1) { d *= 2; if (d > 9) d -= 9; }
            soma += d;
        }
        return soma % 10 == 0;
    }
}
