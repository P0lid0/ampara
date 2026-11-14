using System.Text;

namespace Ampara.Application.Cyber;

/// <summary>
/// Deixa o texto numa forma única antes dos detectores: dígitos de largura total viram ASCII (FormKC),
/// caracteres invisíveis somem e espaços especiais viram espaço comum.
/// </summary>
public static class Normalizador
{
    public static string Normalizar(string s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;

        var sb = new StringBuilder(s.Length);
        foreach (var ch in SanearSubstitutos(s).Normalize(NormalizationForm.FormKC))
        {
            switch (ch)
            {
                case '\u200B' or '\u200C' or '\u200D' or '\u2060' or '\uFEFF':
                    break;
                case '\u00A0' or '\u202F' or '\u205F' or '\u3000' or (>= '\u2000' and <= '\u200A'):
                    sb.Append(' ');
                    break;
                default:
                    sb.Append(ch);
                    break;
            }
        }
        return sb.ToString();
    }

    /// <summary>Surrogate solto (JSON com metade de emoji) faz Normalize lançar; vira U+FFFD, que nunca casa com detector.</summary>
    private static string SanearSubstitutos(string s)
    {
        StringBuilder? sb = null;
        for (var i = 0; i < s.Length; i++)
        {
            var ch = s[i];
            if (char.IsHighSurrogate(ch) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
            {
                sb?.Append(ch).Append(s[i + 1]);
                i++;
                continue;
            }
            if (char.IsSurrogate(ch)) { sb ??= new StringBuilder(s, 0, i, s.Length); sb.Append((char)0xFFFD); continue; }
            sb?.Append(ch);
        }
        return sb?.ToString() ?? s;
    }
}
