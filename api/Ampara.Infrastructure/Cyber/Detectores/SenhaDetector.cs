using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>Segredo: por chave (senha, token de serviço, cookie...) e por valor "senha: xyz". A detecção cobre só o segredo.</summary>
public sealed class SenhaDetector : IPiiDetector
{
    private static readonly Regex Rx = Validacao.Rx(
        @"(?<![0-9A-Za-z])(?:senha|password|pwd)\s*(?::|=|é)\s*(?<segredo>\S{3,})", RegexOptions.IgnoreCase);
    private static readonly string[] Termos =
    [
        "senha", "password", "passwd", "pwd", "palavrasecreta", "segredo", "authorization", "cookie",
        "xchaveservico", "xchavepolicia", "xapikey",
    ];

    public PiiClasse Classe => PiiClasse.Senha;

    public IReadOnlyList<Deteccao> Detectar(string textoNormalizado) =>
        Rx.Matches(textoNormalizado)
            .Select(m => m.Groups["segredo"])
            .Select(g => new Deteccao(Classe, g.Index, g.Length))
            .ToList();

    public bool ChaveIndica(string chaveNormalizada) => Chaves.Indica(chaveNormalizada, Termos);
}
