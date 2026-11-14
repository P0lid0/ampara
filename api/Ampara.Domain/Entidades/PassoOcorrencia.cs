namespace Ampara.Domain.Entidades;

/// <summary>Um dos cinco passos do bloqueio de uma ocorrência. Pendente enquanto <see cref="ConcluidoEm"/> é nulo.</summary>
public sealed class PassoOcorrencia
{
    public Guid Id { get; private set; }
    public Guid OcorrenciaId { get; private set; }
    public PassoBloqueio Passo { get; private set; }
    public DateTime? ConcluidoEm { get; private set; }

    private PassoOcorrencia() { }

    internal static PassoOcorrencia Pendente(Guid ocorrenciaId, PassoBloqueio passo) => new()
    {
        Id = Guid.NewGuid(),
        OcorrenciaId = ocorrenciaId,
        Passo = passo,
    };

    internal bool Concluir(DateTime agora)
    {
        if (ConcluidoEm.HasValue) return false;
        ConcluidoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc);
        return true;
    }
}
