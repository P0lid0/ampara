using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>IMEI: exatamente 15 dígitos (grupos 2-6-6-1 ou 8-6-1 aceitam '-' ou espaço) com Luhn válido.</summary>
public sealed class ImeiDetector : IPiiDetector
{
    private static readonly Regex Rx = Validacao.Rx(
        Validacao.Ini + @"(?:\d{2}[- ]?\d{6}[- ]?\d{6}[- ]?\d|\d{8}[- ]?\d{6}[- ]?\d)" + Validacao.Fim);
    private static readonly string[] Termos = ["imei"];

    public PiiClasse Classe => PiiClasse.Imei;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(textoNormalizado)
            .Where(m => { var d = Validacao.Digitos(m.Value); return d.Length == 15 && Validacao.Luhn(d); })
            .Select(m => new Deteccao(Classe, m.Index, m.Length))
            .ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
