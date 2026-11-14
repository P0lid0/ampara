namespace Ampara.Application.Alertas;

public sealed class OpcoesEscalonamento
{
    /// <summary>Quanto o alerta mais recente espera pelo "ciente" antes de escalar para o próximo guardião.</summary>
    public TimeSpan TempoCiente { get; init; } = TimeSpan.FromSeconds(60);
}
