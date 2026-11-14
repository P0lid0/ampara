using System.Text.Json;
using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>Um dado sensível achado: onde (caminho do campo), de que classe, o trecho e se a chave sozinha o denunciou.</summary>
public sealed record AchadoPii(string Campo, PiiClasse Classe, string Valor, bool PorChave);

/// <summary>Varre JSON, pares chave/valor e texto livre atrás de PII, nome do campo incluído.</summary>
public interface IPiiScanner
{
    /// <summary>Percurso iterativo; caminho no formato <c>usuario.contatos[1].telefone</c>.</summary>
    IReadOnlyList<AchadoPii> EscanearJson(JsonElement raiz);

    /// <summary>Form, query e header. <paramref name="chavesExtras"/> (já normalizadas) tratam a chave como Senha.</summary>
    IReadOnlyList<AchadoPii> EscanearPares(IEnumerable<KeyValuePair<string, string?>> pares, IReadOnlyCollection<string>? chavesExtras = null);

    IReadOnlyList<AchadoPii> EscanearTexto(string texto, string campo = "texto");

    /// <summary>Detecções de todos os detectores no texto já normalizado, em ordem de posição.</summary>
    IReadOnlyList<Deteccao> Localizar(string textoNormalizado);
}
