using System.Globalization;
using System.Text;

namespace Ampara.Application.Cyber;

/// <summary>Nomes de campo: forma normalizada e regra de casamento com os termos de cada classe.</summary>
public static class Chaves
{
    /// <summary>Minúsculas, sem acento e sem '_', '-', '.' nem espaço ("palavraSecreta" vira "palavrasecreta").</summary>
    public static string Normalizar(string chave)
    {
        if (string.IsNullOrEmpty(chave)) return string.Empty;

        var sb = new StringBuilder(chave.Length);
        foreach (var ch in chave.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if (ch is '_' or '-' or '.' || char.IsWhiteSpace(ch)) continue;
            sb.Append(char.ToLowerInvariant(ch));
        }
        return sb.ToString();
    }

    /// <summary>
    /// Termo de 2 letras: igualdade. Termo de 3 letras: igual, prefixo ou sufixo. Termo de 4 ou mais: contido.
    /// Tanto a chave quanto os termos já vêm normalizados.
    /// </summary>
    public static bool Indica(string chaveNormalizada, IEnumerable<string> termos)
    {
        if (string.IsNullOrEmpty(chaveNormalizada)) return false;
        foreach (var t in termos)
        {
            var ok = t.Length switch
            {
                <= 2 => chaveNormalizada == t,
                3 => chaveNormalizada == t
                     || chaveNormalizada.StartsWith(t, StringComparison.Ordinal)
                     || chaveNormalizada.EndsWith(t, StringComparison.Ordinal),
                _ => chaveNormalizada.Contains(t, StringComparison.Ordinal),
            };
            if (ok) return true;
        }
        return false;
    }
}
