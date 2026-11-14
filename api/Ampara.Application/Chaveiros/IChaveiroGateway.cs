namespace Ampara.Application.Chaveiros;

/// <summary>Saída de comandos para o chaveiro. A implementação real (MQTT, T15) publica em citizentech/chaveiro/{deviceId}/cmd.</summary>
public interface IChaveiroGateway
{
    bool Conectado { get; }
    Task PublicarComandoAsync(string deviceId, ComandoChaveiro cmd, CancellationToken ct);
}
