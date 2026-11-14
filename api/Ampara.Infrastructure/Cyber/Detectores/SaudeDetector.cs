using System.Text;
using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>Dado de saúde: termos inteiros (sem acento e sem caixa) e código CID.</summary>
public sealed class SaudeDetector : IPiiDetector
{
    private static readonly string[] Palavras =
    [
        "laudo", "diagnostico", "prontuario", "atestado medico", "receita medica", "hiv", "depressao", "ansiedade",
        "diabetes", "cancer", "hipertensao", "psiquiatrico", "esquizofrenia", "internacao", "tratamento oncologico",
    ];
    private static readonly Regex Rx = Validacao.Rx(
        @"(?<![0-9A-Za-z])(?:" + string.Join("|", Palavras.Select(p => p.Replace(" ", @"\s+")))
        + @"|CID[- ]?[A-Z]\d{2})(?![0-9A-Za-z])", RegexOptions.IgnoreCase);
    private static readonly string[] Termos = ["laudo", "diagnostico", "saude", "cid", "prontuario", "medicamento", "doenca"];

    public PiiClasse Classe => PiiClasse.Saude;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(Dobrar(textoNormalizado)).Select(m => new Deteccao(Classe, m.Index, m.Length)).ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);

    /// <summary>Minúsculas e sem acento, com o mesmo tamanho do original (os índices continuam valendo).</summary>
    private static string Dobrar(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
            sb.Append(char.ToLowerInvariant(DobrarChar(ch)));
        return sb.ToString();
    }

    // Metade de par substituto (emoji) não pode ser normalizada sozinha; fica como está e o tamanho se mantém.
    private static char DobrarChar(char ch)
    {
        if (char.IsSurrogate(ch)) return ch;
        try { return ch.ToString().Normalize(NormalizationForm.FormD)[0]; }
        catch (ArgumentException) { return ch; }
    }
}
