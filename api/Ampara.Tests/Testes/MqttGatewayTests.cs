using System.Text.RegularExpressions;
using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Ampara.Infrastructure.Mqtt;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Tests;

public partial class MqttGatewayTests
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

    [Theory]
    [InlineData("events")]
    [InlineData("status")]
    public async Task Payload_despachado_nao_passa_pela_politica_do_log(string tipo)
    {
        // Guard com a política do plano 03 para o sink Log: bloqueia e troca o achado por [BLOQUEADO:Classe].
        // O ts de 10 dígitos começando por DDD casa o detector de Telefone; se o texto do Log fosse despachado,
        // o JSON quebraria e o alerta seria descartado sem ack.
        var svc = new EventoServiceEspiao();
        var sp = new ServiceCollection()
            .AddScoped<ITaintGuard, GuardQueBloqueiaLog>()
            .AddScoped<IChaveiroEventoService>(_ => svc)
            .AddSingleton<IMqttPiiFilter>(p => new MqttPiiFilter(p.GetRequiredService<IServiceScopeFactory>(),
                new PiiScanner(Cyber.DetectoresTests.TodosDetectores())))
            .BuildServiceProvider();
        using var gw = new MqttChaveiroGateway(sp.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System,
            new ConfigurationBuilder().Build(), NullLogger<MqttChaveiroGateway>.Instance);
        const string payload = """{"eventId":"chaveiro-ampara-a1b2c3-17","type":"alert","deviceId":"chaveiro-ampara-a1b2c3","ts":1794700000,"ageMs":140,"battery":82}""";

        await gw.DespacharAsync($"citizentech/chaveiro/chaveiro-ampara-a1b2c3/{tipo}", payload);

        var (deviceId, recebido) = Assert.Single(svc.Recebidos);
        Assert.Equal("chaveiro-ampara-a1b2c3", deviceId);
        Assert.Equal(payload, recebido);
    }

    private sealed partial class GuardQueBloqueiaLog : ITaintGuard
    {
        [GeneratedRegex(@"\b[1-9][1-9]\d{8}\b")]
        private static partial Regex Telefone();

        public bool Ativo => true;

        public ResultadoTaint Sanitizar(string texto, Sink sink, SanitizarOpcoes? o = null) =>
            sink == Sink.Log && Telefone().IsMatch(texto)
                ? new ResultadoTaint(Telefone().Replace(texto, "[BLOQUEADO:Telefone]"), true, [])
                : new ResultadoTaint(texto, false, []);
    }

    private sealed class EventoServiceEspiao : IChaveiroEventoService
    {
        public List<(string DeviceId, string Payload)> Recebidos { get; } = [];

        public Task TratarEventoAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct)
        { Recebidos.Add((deviceIdDoTopico, payload)); return Task.CompletedTask; }

        public Task TratarStatusAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct)
        { Recebidos.Add((deviceIdDoTopico, payload)); return Task.CompletedTask; }
    }
}
