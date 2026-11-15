using System.Globalization;
using System.Text;

namespace Ampara.Application.Cyber;

/// <summary>
/// Deixa o texto numa forma única antes dos detectores: dígitos de largura total viram ASCII (FormKC),
/// dígitos de outras escritas (árabe-índicos, devanágari...) viram ASCII, caracteres de formatação invisíveis
/// (hífen suave, marcas de direção, separadores invisíveis, seletores de variação) somem, traços Unicode viram '-'
/// e espaços especiais viram espaço comum. Sem isso, um CPF com hífen suave (U+00AD) ou travessão curto (U+2013) passaria por todos os sinks.
/// </summary>
public static class Normalizador
{
    public static string Normalizar(string s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;

        var sb = new StringBuilder(s.Length);
        foreach (var r in SanearSubstitutos(s).Normalize(NormalizationForm.FormKC).EnumerateRunes())
        {
            var v = r.Value;
            switch (Rune.GetUnicodeCategory(r))
            {
                case UnicodeCategory.Format:                          // U+00AD, U+200B-200F, U+202A-202E, U+2060-2069, U+FEFF, U+180E, tags...
                    continue;
                case UnicodeCategory.DashPunctuation:                 // U+2010-2015, U+FE58, U+FE63...
                    sb.Append('-');
                    continue;
                case UnicodeCategory.DecimalDigitNumber when v > 0x7F: // U+0660-0669, U+06F0-06F9, U+0966-096F...
                    sb.Append((char)('0' + (int)Rune.GetNumericValue(r)));
                    continue;
                case UnicodeCategory.SpaceSeparator:                  // U+00A0, U+2000-200A, U+202F, U+205F, U+3000
                    sb.Append(' ');
                    continue;
            }
            if (v == 0x2212) { sb.Append('-'); continue; }           // sinal de menos (categoria Sm)
            if (v is (>= 0xFE00 and <= 0xFE0F) or (>= 0xE0100 and <= 0xE01EF) or 0x034F) continue;   // seletores de variação e CGJ
            sb.Append(r.ToString());
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
