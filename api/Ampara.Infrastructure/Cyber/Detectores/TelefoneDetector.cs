using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>
/// Telefone brasileiro: com pontuação ("(11) 98765-4321", "+55 11 98765-4321", "11 3456-7890") ou só dígitos
/// quando são 11 com DDD 11-99 e 9 de celular na 3ª posição, e não formam um CPF válido (CPF vence).
/// </summary>
public sealed class TelefoneDetector : IPiiDetector
{
    private static readonly Regex Rx = Validacao.Rx(
        Validacao.Ini + @"(?:" +
        @"(?<f>(?:\+55[ -]?)?\(\d{2}\)[ -]?9?\d{4}[- ]?\d{4})" +
        @"|(?<f>\+55\d{10,11})" +
        @"|(?<f>(?:\+55[ -]?)?\d{2}[ -]9?\d{4}[- ]?\d{4})" +
        @"|(?<b>\d{11})" +
        @")" + Validacao.Fim);
    private static readonly string[] Termos = ["telefone", "celular", "fone", "whatsapp"];

    public PiiClasse Classe => PiiClasse.Telefone;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado)
    {
        var achados = new List<Deteccao>();
        foreach (Match m in Rx.Matches(textoNormalizado))
        {
            var d = Validacao.Digitos(m.Value);
            if (m.Value.StartsWith('+') && d.StartsWith("55")) d = d[2..];

            if (d.Length is not (10 or 11)) continue;
            var ddd = int.Parse(d.AsSpan(0, 2));
            if (ddd is < 11 or > 99) continue;
            if (d.Length == 11 && d[2] != '9') continue;
            if (m.Groups["b"].Success && Validacao.CpfValido(d)) continue;

            achados.Add(new Deteccao(Classe, m.Index, m.Length));
        }
        return achados;
    }

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
