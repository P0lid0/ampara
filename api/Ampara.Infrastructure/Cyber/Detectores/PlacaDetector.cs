using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>Placa de veículo: Mercosul (ABC1D23, aceita minúsculas) e antiga (ABC-1234 ou ABC1234, só maiúsculas).</summary>
public sealed class PlacaDetector : IPiiDetector
{
    private static readonly Regex Rx = Validacao.Rx(
        Validacao.Ini + @"(?:(?i:[A-Z]{3}\d[A-Z]\d{2})|[A-Z]{3}-?\d{4})" + Validacao.Fim);
    private static readonly string[] Termos = ["placa"];

    public PiiClasse Classe => PiiClasse.Placa;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(textoNormalizado).Select(m => new Deteccao(Classe, m.Index, m.Length)).ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
