using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>RG: por valor só no formato NN.NNN.NNN-D; por chave (rg, identidade) vale qualquer valor.</summary>
public sealed class RgDetector : IPiiDetector
{
    private static readonly Regex Rx = Validacao.Rx(Validacao.Ini + @"\d{2}\.\d{3}\.\d{3}-[0-9Xx]" + Validacao.Fim);
    private static readonly string[] Termos = ["rg", "identidade"];

    public PiiClasse Classe => PiiClasse.Rg;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(textoNormalizado).Select(m => new Deteccao(Classe, m.Index, m.Length)).ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
