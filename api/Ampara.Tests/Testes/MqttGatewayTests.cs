using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;
using Ampara.Infrastructure.Mqtt;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Tests;

public class MqttGatewayTests
{
    [Fact]
    public async Task Publicar_comando_sem_conexao_lanca_mqtt_indisponivel()
    {
        using var gw = new MqttChaveiroGateway(
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            TimeProvider.System, new ConfigurationBuilder().Build(), NullLogger<MqttChaveiroGateway>.Instance);
        Assert.False(gw.Conectado);
        var ex = await Assert.ThrowsAsync<ServicoIndisponivelException>(() =>
            gw.PublicarComandoAsync("chaveiro-x", ComandoChaveiro.Ack("e1"), CancellationToken.None));
        Assert.Equal("mqtt-indisponivel", ex.Codigo);
    }
}
