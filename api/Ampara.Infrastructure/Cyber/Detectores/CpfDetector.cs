using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>CPF: 11 dígitos (com ou sem pontuação), dígitos verificadores válidos, não repetido.</summary>
public sealed class CpfDetector : IPiiDetector
{
    private static readonly Regex Rx =
        Validacao.Rx(Validacao.Ini + @"\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}" + Validacao.Fim);
    private static readonly string[] Termos = ["cpf", "documento"];

    public PiiClasse Classe => PiiClasse.Cpf;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(textoNormalizado)
            .Where(m => Validacao.CpfValido(Validacao.Digitos(m.Value)))
            .Select(m => new Deteccao(Classe, m.Index, m.Length))
            .ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
