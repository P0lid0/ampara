using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>E-mail. Partes com tamanho limitado para a busca ficar linear em texto longo sem '@'.</summary>
public sealed class EmailDetector : IPiiDetector
{
    private const string Rotulo = @"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
    private static readonly Regex Rx = Validacao.Rx(
        @"(?<![0-9A-Za-z._%+-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@" + Rotulo + @"(?:\." + Rotulo + @")*\.[A-Za-z]{2,24}(?![0-9A-Za-z-])");
    private static readonly string[] Termos = ["email"];

    public PiiClasse Classe => PiiClasse.Email;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(textoNormalizado).Select(m => new Deteccao(Classe, m.Index, m.Length)).ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
