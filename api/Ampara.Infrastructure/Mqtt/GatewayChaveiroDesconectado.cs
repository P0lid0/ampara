using Ampara.Application.Chaveiros;

namespace Ampara.Infrastructure.Mqtt;

/// <summary>Gateway provisório até o MQTT (T15): nunca conectado, descarta o comando.</summary>
public sealed class GatewayChaveiroDesconectado : IChaveiroGateway
{
    public bool Conectado => false;
    public Task PublicarComandoAsync(string deviceId, ComandoChaveiro cmd, CancellationToken ct) => Task.CompletedTask;
}
