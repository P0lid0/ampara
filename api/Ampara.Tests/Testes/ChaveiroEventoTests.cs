using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Chaveiros;
using Ampara.Domain;
using Ampara.Domain.Entidades;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class ChaveiroEventoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Dev = "chaveiro-ampara-a1b2c3";

    public static string Evento(string tipo, string deviceId, string eventId, long? ts = null, int ageMs = 140, int battery = 82, string? alertId = null)
        => JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["eventId"] = eventId, ["type"] = tipo, ["deviceId"] = deviceId, ["alertId"] = alertId ?? eventId,
            ["ts"] = ts, ["ageMs"] = ageMs, ["attempt"] = 1, ["battery"] = battery, ["fw"] = "1.0.0",
        });

    private DateTime Chegada => f.Tempo.GetUtcNow().UtcDateTime.AddSeconds(-1);

    /// <summary>Usuário com guardião vinculado e um chaveiro pareado de id único (os testes dividem a fábrica).</summary>
    private async Task<(Sessao Vitima, string Dev)> ChaveiroPareadoAsync()
    {
        var v = await f.NovoUsuarioAsync();
        await f.VincularGuardiaoAsync(v);
        var dev = "chaveiro-ampara-" + Guid.NewGuid().ToString("N")[..8];
        (await v.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = dev })).EnsureSuccessStatusCode();
        return (v, dev);
    }

    private async Task TratarAsync(string deviceId, string payload, DateTime chegada)
    {
        using var escopo = f.Services.CreateScope();
        await escopo.ServiceProvider.GetRequiredService<IChaveiroEventoService>().TratarEventoAsync(deviceId, payload, chegada, CancellationToken.None);
    }

    private async Task StatusAsync(string deviceId, string payload, DateTime chegada)
    {
        using var escopo = f.Services.CreateScope();
        await escopo.ServiceProvider.GetRequiredService<IChaveiroEventoService>().TratarStatusAsync(deviceId, payload, chegada, CancellationToken.None);
    }

    private int Acks(string dev, string? eventId = null) =>
        f.Gateway.Publicados.Count(p => p.DeviceId == dev && p.Cmd.Cmd == "ack" && (eventId is null || p.Cmd.EventId == eventId));

    [Fact]
    public async Task Alert_cria_uma_ocorrencia_de_chaveiro_e_responde_ack()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        var id = dev + "-17"; var chegada = Chegada;
        await TratarAsync(dev, Evento("alert", dev, id), chegada);

        using var db = f.NovoDb();
        var o = db.Ocorrencias.Single(x => x.UsuarioId == v.UsuarioId);
        Assert.Equal(OrigemGatilho.Chaveiro, o.Origem);
        Assert.Equal(chegada.AddMilliseconds(-140), o.IniciadaEm);
        Assert.Equal(id, o.ChaveiroAlertId);
        Assert.Equal(1, Acks(dev, id));
        var reg = db.EventosRecebidos.Single(e => e.EventId == id);
        Assert.Equal(o.Id, reg.OcorrenciaId);
    }

    [Fact]
    public async Task Alert_com_ts_usa_a_hora_do_clique()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        var clique = f.Tempo.GetUtcNow().AddSeconds(-30);
        await TratarAsync(dev, Evento("alert", dev, dev + "-1", ts: clique.ToUnixTimeSeconds()), Chegada);
        using var db = f.NovoDb();
        Assert.Equal(clique.UtcDateTime, db.Ocorrencias.Single(x => x.UsuarioId == v.UsuarioId).IniciadaEm);
    }

    [Fact]
    public async Task Mesmo_eventId_cinco_vezes_gera_uma_ocorrencia_e_cinco_acks()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        var id = dev + "-17"; var chegada = Chegada;
        for (var i = 0; i < 5; i++) await TratarAsync(dev, Evento("alert", dev, id), chegada.AddMilliseconds(i));
        using var db = f.NovoDb();
        Assert.Equal(1, db.Ocorrencias.Count(o => o.UsuarioId == v.UsuarioId));
        Assert.Equal(1, db.EventosRecebidos.Count(e => e.EventId == id));
        Assert.Equal(5, Acks(dev, id));
    }

    [Fact]
    public async Task Cancel_fecha_a_ocorrencia_e_ack_mesmo_com_alerta_desconhecido()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        var alerta = dev + "-5";
        await TratarAsync(dev, Evento("alert", dev, alerta), Chegada);
        await TratarAsync(dev, Evento("cancel", dev, dev + "-6", alertId: alerta), Chegada);
        using (var db = f.NovoDb())
            Assert.Equal(EstadoOcorrencia.Cancelada, db.Ocorrencias.Single(o => o.UsuarioId == v.UsuarioId).Estado);
        Assert.Equal(1, Acks(dev, dev + "-6"));

        await TratarAsync(dev, Evento("cancel", dev, dev + "-7", alertId: "alerta-que-nao-existe"), Chegada);
        Assert.Equal(1, Acks(dev, dev + "-7"));
    }

    private async Task<(Sessao Vitima, string Dev, HttpClient Emergencia, Guid OcorrenciaId)> WebDepoisChaveiroAsync()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        (await v.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "123456", palavraSecreta = "palavra-sintetica" })).EnsureSuccessStatusCode();
        var em = await f.ClienteEmergenciaAsync(v.Email, "123456", "palavra-sintetica");
        var r = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        r.EnsureSuccessStatusCode();
        var id = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ocorrenciaId").GetGuid();
        // Segundos depois a vítima aperta o chaveiro: o alert reaproveita a ocorrência aberta.
        await TratarAsync(dev, Evento("alert", dev, dev + "-20"), Chegada);
        return (v, dev, em, id);
    }

    [Fact]
    public async Task Web_depois_chaveiro_vincula_o_alerta_e_o_cancel_do_chaveiro_fecha()
    {
        var (v, dev, _, id) = await WebDepoisChaveiroAsync();
        using (var db = f.NovoDb())
        {
            var o = db.Ocorrencias.Single(x => x.UsuarioId == v.UsuarioId);
            Assert.Equal(id, o.Id);
            Assert.Equal((dev, dev + "-20"), (o.ChaveiroDeviceId, o.ChaveiroAlertId));
        }
        Assert.Equal(1, Acks(dev, dev + "-20"));

        await TratarAsync(dev, Evento("cancel", dev, dev + "-21", alertId: dev + "-20"), Chegada);
        using (var db = f.NovoDb())
            Assert.Equal(EstadoOcorrencia.Cancelada, db.Ocorrencias.Single(x => x.Id == id).Estado);
    }

    [Fact]
    public async Task Web_depois_chaveiro_cancelar_pelo_app_publica_resolve()
    {
        var (_, dev, em, id) = await WebDepoisChaveiroAsync();

        var antes = f.Gateway.Publicados.Count(p => p.DeviceId == dev && p.Cmd.Cmd == "resolve");
        Assert.Equal(System.Net.HttpStatusCode.NoContent, (await em.PostAsync($"/api/v1/ocorrencias/{id}/cancelar", null)).StatusCode);
        var resolve = Assert.Single(f.Gateway.Publicados.Where(p => p.DeviceId == dev && p.Cmd.Cmd == "resolve").Skip(antes));
        Assert.Equal(dev + "-20", resolve.Cmd.AlertId);
    }

    [Fact]
    public async Task Test_so_atualiza_sinal_e_ack_sem_acionar_ninguem()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        var chegada = Chegada;
        await TratarAsync(dev, Evento("test", dev, dev + "-3", battery: 64), chegada);
        using var db = f.NovoDb();
        Assert.Empty(db.Ocorrencias.Where(o => o.UsuarioId == v.UsuarioId));
        var c = db.Chaveiros.Single(x => x.DeviceId == dev);
        Assert.True(c.Online); Assert.Equal(64, c.Bateria); Assert.Equal(chegada, c.VistoEm);
        Assert.Equal(1, Acks(dev, dev + "-3"));
    }

    [Fact]
    public async Task Low_battery_atualiza_bateria_sem_ack()
    {
        var (_, dev) = await ChaveiroPareadoAsync();
        await TratarAsync(dev, Evento("low_battery", dev, dev + "-9", battery: 12), Chegada);
        using var db = f.NovoDb();
        var c = db.Chaveiros.Single(x => x.DeviceId == dev);
        Assert.Equal(12, c.Bateria); Assert.True(c.BateriaBaixa);
        Assert.Equal(0, Acks(dev));
    }

    [Fact]
    public async Task Chaveiro_nao_pareado_recebe_ack_e_nao_gera_ocorrencia()
    {
        var dev = "chaveiro-ampara-" + Guid.NewGuid().ToString("N")[..8];
        var antes = f.NovoDb().Ocorrencias.Count();
        await TratarAsync(dev, Evento("alert", dev, dev + "-1"), Chegada);
        using var db = f.NovoDb();
        Assert.Equal(antes, db.Ocorrencias.Count());
        Assert.Empty(db.EventosRecebidos.Where(e => e.DeviceId == dev));
        Assert.Equal(1, Acks(dev, dev + "-1"));
    }

    [Fact]
    public async Task Json_valido_acima_de_2048_bytes_e_descartado_sem_ack()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        var id = dev + "-grande";
        var grande = Evento("alert", dev, id).TrimEnd('}') + ",\"enchimento\":\"" + new string('x', 2100) + "\"}";
        Assert.NotNull(JsonDocument.Parse(grande));
        await TratarAsync(dev, grande, Chegada);
        await StatusAsync(dev, $"{{\"deviceId\":\"{dev}\",\"online\":true,\"enchimento\":\"{new string('x', 2100)}\"}}", Chegada);

        using var db = f.NovoDb();
        Assert.Empty(db.Ocorrencias.Where(o => o.UsuarioId == v.UsuarioId));
        Assert.Empty(db.EventosRecebidos.Where(e => e.EventId == id));
        Assert.Equal(0, Acks(dev));
        Assert.False(db.Chaveiros.Single(x => x.DeviceId == dev).Online);
    }

    [Theory]
    [MemberData(nameof(PayloadsMalformados))]
    public async Task Mensagem_malformada_e_descartada_sem_excecao_sem_ack_sem_ocorrencia(string deviceDoTopico, string payload)
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        // O tópico/payload do caso usam Dev fixo; troca pelo chaveiro pareado deste teste.
        deviceDoTopico = deviceDoTopico == Dev ? dev : deviceDoTopico;
        payload = payload.Replace(Dev, dev);
        await TratarAsync(deviceDoTopico, payload, Chegada);
        using var db = f.NovoDb();
        Assert.Empty(db.Ocorrencias.Where(o => o.UsuarioId == v.UsuarioId));
        Assert.Equal(0, Acks(dev)); Assert.Equal(0, Acks(deviceDoTopico));
        Assert.Empty(db.EventosRecebidos.Where(e => e.DeviceId == dev));
    }

    [Theory]
    [InlineData(101, 140, null)]            // battery fora de 0..100
    [InlineData(82, -5, null)]              // ageMs negativo
    [InlineData(82, 140, 999999999999L)]    // ts fora do intervalo de DateTime
    [InlineData(82, 140, 0L)]               // ts de relógio sem NTP
    public async Task Alert_com_telemetria_fora_da_faixa_nao_se_perde_e_recebe_ack(int battery, int ageMs, long? ts)
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        await TratarAsync(dev, Evento("alert", dev, dev + "-9", ts: ts, ageMs: ageMs, battery: battery), Chegada);
        using var db = f.NovoDb();
        var o = db.Ocorrencias.Single(x => x.UsuarioId == v.UsuarioId);
        Assert.Equal(Chegada.AddMilliseconds(-Math.Max(ageMs, 0)), o.IniciadaEm);
        Assert.Equal(1, Acks(dev));
    }

    public static IEnumerable<object[]> PayloadsMalformados() =>
    [
        [Dev, "isto nao e json"],
        [Dev, "{}"],
        [Dev, Evento("desconhecido", Dev, "x-1")],
        ["chaveiro-ampara-outro1", Evento("alert", Dev, "x-2")],   // tópico != payload
        [Dev, new string('a', 5000)],
        [Dev, "{\"eventId\":\"x-3\",\"type\":\"alert\",\"deviceId\":\"" + Dev + "\",\"ts\":\"texto\"}"],
        [Dev, "[1,2,3]"],
        [Dev, Evento("alert", Dev, new string('e', 200))],                                  // eventId maior que a coluna
        [Dev, Evento("alert", Dev, "x-4", alertId: new string('a', 200))],                  // alertId maior que a coluna
        [Dev, "{\"eventId\":7,\"type\":\"alert\",\"deviceId\":\"" + Dev + "\"}"],
    ];

    [Fact]
    public async Task Falha_ao_publicar_ack_nao_desfaz_a_acao_nem_propaga()
    {
        var (v, dev) = await ChaveiroPareadoAsync();
        f.Gateway.Falhar = true;
        try { await TratarAsync(dev, Evento("alert", dev, dev + "-1"), Chegada); }
        finally { f.Gateway.Falhar = false; }
        using var db = f.NovoDb();
        Assert.Single(db.Ocorrencias.Where(o => o.UsuarioId == v.UsuarioId));
        Assert.Single(db.EventosRecebidos.Where(e => e.DeviceId == dev));
    }

    [Fact]
    public async Task Status_e_ultima_vontade()
    {
        var (_, dev) = await ChaveiroPareadoAsync();
        await StatusAsync(dev, $"{{\"deviceId\":\"{dev}\",\"online\":true,\"battery\":82}}", Chegada);
        using (var db = f.NovoDb())
        {
            var c = db.Chaveiros.Single(x => x.DeviceId == dev);
            Assert.True(c.Online); Assert.Equal(82, c.Bateria);
        }
        await StatusAsync(dev, $"{{\"deviceId\":\"{dev}\",\"online\":false}}", Chegada);
        using (var db = f.NovoDb())
        {
            var c = db.Chaveiros.Single(x => x.DeviceId == dev);
            Assert.False(c.Online); Assert.Equal(82, c.Bateria);
        }
        // status de outro device no tópico é descartado
        await StatusAsync("chaveiro-ampara-outro1", $"{{\"deviceId\":\"{dev}\",\"online\":true}}", Chegada);
        using (var db = f.NovoDb()) Assert.False(db.Chaveiros.Single(x => x.DeviceId == dev).Online);
    }
}
