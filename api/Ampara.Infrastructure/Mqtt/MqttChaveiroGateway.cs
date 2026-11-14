using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ampara.Application.Chaveiros;
using Ampara.Application.Cyber;
using Ampara.Application.Comum;
using Ampara.Domain.Cyber;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MQTTnet;
using MQTTnet.Protocol;

namespace Ampara.Infrastructure.Mqtt;

/// <summary>Cliente MQTT do chaveiro: assina eventos e status, publica comandos. Reconecta sozinho (espera de 1 s até 30 s).</summary>
public sealed class MqttChaveiroGateway : BackgroundService, IChaveiroGateway
{
    private static readonly TimeSpan EsperaMin = TimeSpan.FromSeconds(1), EsperaMax = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _escopos;
    private readonly TimeProvider _tempo;
    private readonly ILogger<MqttChaveiroGateway> _log;
    private readonly string _host;
    private readonly int _porta;
    private readonly IMqttClient _cliente = new MqttClientFactory().CreateMqttClient();

    public MqttChaveiroGateway(IServiceScopeFactory escopos, TimeProvider tempo, IConfiguration cfg, ILogger<MqttChaveiroGateway> log)
    {
        _escopos = escopos; _tempo = tempo; _log = log;
        _host = string.IsNullOrWhiteSpace(cfg["MQTT_HOST"]) ? "broker.hivemq.com" : cfg["MQTT_HOST"]!;
        _porta = int.TryParse(cfg["MQTT_PORT"], out var p) && p > 0 ? p : 1883;
        _cliente.ApplicationMessageReceivedAsync += AoReceberAsync;
    }

    public bool Conectado => _cliente.IsConnected;

    public async Task PublicarComandoAsync(string deviceId, ComandoChaveiro cmd, CancellationToken ct)
    {
        if (!Conectado) throw new ServicoIndisponivelException("mqtt-indisponivel");
        var msg = new MqttApplicationMessageBuilder()
            .WithTopic(TopicoChaveiro.Cmd(deviceId))
            .WithPayload(JsonSerializer.SerializeToUtf8Bytes(cmd))
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .WithRetainFlag(false)
            .Build();
        try { await _cliente.PublishAsync(msg, ct); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning("Falha ao publicar comando MQTT: {Tipo}", ex.GetType().Name);
            throw new ServicoIndisponivelException("mqtt-indisponivel");
        }
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var espera = EsperaMin;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!_cliente.IsConnected)
                {
                    await ConectarAsync(ct);
                    espera = EsperaMin;
                    _log.LogInformation("MQTT conectado a {Host}:{Porta}", _host, _porta);
                }
                await Task.Delay(TimeSpan.FromSeconds(1), ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _log.LogWarning("MQTT indisponivel ({Tipo}); nova tentativa em {Seg}s", ex.GetType().Name, espera.TotalSeconds);
                try { await Task.Delay(espera, ct); } catch (OperationCanceledException) { break; }
                espera = TimeSpan.FromSeconds(Math.Min(espera.TotalSeconds * 2, EsperaMax.TotalSeconds));
            }
        }
        if (_cliente.IsConnected)
            try { await _cliente.DisconnectAsync(cancellationToken: CancellationToken.None); } catch { /* encerrando */ }
    }

    public override void Dispose()
    {
        _cliente.Dispose();
        base.Dispose();
    }

    private async Task ConectarAsync(CancellationToken ct)
    {
        var opcoes = new MqttClientOptionsBuilder()
            .WithTcpServer(_host, _porta)
            .WithClientId("ampara-api-" + Sufixo(6))
            .WithCleanSession(true)
            .WithKeepAlivePeriod(TimeSpan.FromSeconds(30))
            .WithTimeout(TimeSpan.FromSeconds(10))
            .Build();
        await _cliente.ConnectAsync(opcoes, ct);
        var assinatura = new MqttClientSubscribeOptionsBuilder()
            .WithTopicFilter(TopicoChaveiro.RaizEventos, MqttQualityOfServiceLevel.AtLeastOnce)
            .WithTopicFilter(TopicoChaveiro.RaizStatus, MqttQualityOfServiceLevel.AtLeastOnce)
            .Build();
        await _cliente.SubscribeAsync(assinatura, ct);
    }

    private async Task AoReceberAsync(MqttApplicationMessageReceivedEventArgs a)
    {
        try
        {
            if (!TopicoChaveiro.TentarLer(a.ApplicationMessage.Topic, out var deviceId, out var tipo)) return;
            var payload = Encoding.UTF8.GetString(a.ApplicationMessage.Payload);
            var chegada = _tempo.GetUtcNow().UtcDateTime;

            using var escopo = _escopos.CreateScope();
            var sp = escopo.ServiceProvider;
            // Ponto de extensao do plano 03: o guard sanitiza o payload antes de despachar (no-op hoje).
            var guard = sp.GetRequiredService<ITaintGuard>();
            var texto = guard.Sanitizar(payload, Sink.Log, new SanitizarOpcoes(OrigemDado.Mqtt, "payload")).Texto;

            var svc = sp.GetRequiredService<IChaveiroEventoService>();
            if (tipo == "events") await svc.TratarEventoAsync(deviceId, texto, chegada, CancellationToken.None);
            else await svc.TratarStatusAsync(deviceId, texto, chegada, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _log.LogWarning("Falha ao tratar mensagem MQTT: {Tipo}", ex.GetType().Name);
        }
    }

    private static string Sufixo(int n)
    {
        const string alfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
        return string.Create(n, 0, static (s, _) => { for (var i = 0; i < s.Length; i++) s[i] = alfabeto[RandomNumberGenerator.GetInt32(alfabeto.Length)]; });
    }
}
