using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Sinaliza que um dado sensível ia sair por um sink que o proíbe. A mensagem nunca leva o valor.</summary>
public sealed class TaintBloqueadoException(Sink sink, PiiClasse classe)
    : Exception($"Dado sensivel da classe {classe} bloqueado no sink {sink}.")
{
    public Sink Sink { get; } = sink;
    public PiiClasse Classe { get; } = classe;
}
