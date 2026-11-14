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
        foreach (var ch in s.Normalize(NormalizationForm.FormKC))
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
}
