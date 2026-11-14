using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>Trecho do texto (já normalizado) em que o detector achou um dado sensível.</summary>
public sealed record Deteccao(PiiClasse Classe, int Inicio, int Tamanho);

/// <summary>Um detector por classe de PII: olha o valor e olha o nome da chave.</summary>
public interface IPiiDetector
{
    PiiClasse Classe { get; }

    /// <summary>Procura no texto já passado por <see cref="Normalizador.Normalizar"/>.</summary>
    IReadOnlyList<Deteccao> Detectar(string textoNormalizado);

    /// <summary>A chave já passada por <see cref="Chaves.Normalizar"/> indica esta classe?</summary>
    bool ChaveIndica(string chaveNormalizada);
}
