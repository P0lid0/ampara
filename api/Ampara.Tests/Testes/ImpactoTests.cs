using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Alertas;
using Ampara.Application.Chaveiros;
using Ampara.Domain;
using Ampara.Tests.Infra;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class ImpactoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static readonly TimeSpan Seg = TimeSpan.FromSeconds(1);

    private DateTime Chegada => f.Tempo.GetUtcNow().UtcDateTime.AddSeconds(-1);

    private async Task<(Sessao Vitima, Sessao Guardiao, string Dev)> ChaveiroPareadoAsync()
    {
        var v = await f.NovoUsuarioAsync();
        var a = await f.VincularGuardiaoAsync(v);
        var dev = "chaveiro-ampara-" + Guid.NewGuid().ToString("N")[..8];
        (await v.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = dev })).EnsureSuccessStatusCode();
        return (v, a, dev);
    }

    private async Task TratarAsync(string dev, string payload)
    {
        using var escopo = f.Services.CreateScope();
        await escopo.ServiceProvider.GetRequiredService<IChaveiroEventoService>().TratarEventoAsync(dev, payload, Chegada, CancellationToken.None);
    }

    private async Task<int> ProcessarAsync()
    {
        using var escopo = f.Services.CreateScope();
        return await escopo.ServiceProvider.GetRequiredService<IEscalonamento>().ProcessarVencidosAsync(CancellationToken.None);
    }

    private int Acks(string dev, string eventId) =>
        f.Gateway.Publicados.Count(p => p.DeviceId == dev && p.Cmd.Cmd == "ack" && p.Cmd.EventId == eventId);

    [Fact]
    public async Task Impacto_nao_alerta_dentro_dos_10_segundos()
    {
        var (v, _, dev) = await ChaveiroPareadoAsync();
        var id = dev + "-1";
        await TratarAsync(dev, ChaveiroEventoTests.Evento("impact", dev, id));

        using var db = f.NovoDb();
        var o = db.Ocorrencias.Single(x => x.UsuarioId == v.UsuarioId);
        Assert.Equal(OrigemGatilho.Impacto, o.Origem);
        Assert.Equal(id, o.ChaveiroAlertId);
        Assert.Equal(o.IniciadaEm.AddSeconds(10), o.AlertasLiberadosEm);
        Assert.Empty(db.Alertas.Where(a => a.OcorrenciaId == o.Id));
        Assert.Equal(1, Acks(dev, id));
        Assert.Equal(0, await ProcessarAsync());   // ainda dentro da janela
        using var db2 = f.NovoDb();
        Assert.Empty(db2.Alertas.Where(a => a.OcorrenciaId == o.Id));

        await v.Cliente.PostAsync($"/api/v1/ocorrencias/{o.Id}/cancelar", null);
    }

    [Fact]
    public async Task Cancel_na_janela_nao_chega_a_alertar()
    {
        var (v, _, dev) = await ChaveiroPareadoAsync();
        var alerta = dev + "-2";
        await TratarAsync(dev, ChaveiroEventoTests.Evento("impact", dev, alerta));

        f.Tempo.Advance(5 * Seg);
        await TratarAsync(dev, ChaveiroEventoTests.Evento("cancel", dev, dev + "-3", alertId: alerta));
        f.Tempo.Advance(10 * Seg);

        Assert.Equal(0, await ProcessarAsync());
        using var db = f.NovoDb();
        var o = db.Ocorrencias.Single(x => x.UsuarioId == v.UsuarioId);
        Assert.Equal(EstadoOcorrencia.Cancelada, o.Estado);
        Assert.Empty(db.Alertas.Where(a => a.OcorrenciaId == o.Id));
    }

    [Fact]
    public async Task Apos_a_janela_alerta_o_guardiao_1()
    {
        var (v, a, dev) = await ChaveiroPareadoAsync();
        var disparados = new List<AlertaDisparadoMsg>();
        var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(f.Server.BaseAddress, "/hubs/guardiao"), o =>
            {
                o.HttpMessageHandlerFactory = _ => f.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.AccessTokenProvider = () => Task.FromResult<string?>(a.Token);
            }).Build();
        hub.On<AlertaDisparadoMsg>("AlertaDisparado", m => { lock (disparados) disparados.Add(m); });
        await hub.StartAsync();
        try
        {
            await TratarAsync(dev, ChaveiroEventoTests.Evento("impact", dev, dev + "-4"));
            await Task.Delay(300);
            lock (disparados) Assert.Empty(disparados);

            f.Tempo.Advance(10 * Seg);
            Assert.Equal(1, await ProcessarAsync());

            var limite = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < limite) { lock (disparados) if (disparados.Count > 0) break; await Task.Delay(25); }
            AlertaDisparadoMsg m;
            lock (disparados) { Assert.Single(disparados); m = disparados[0]; }
            Assert.Equal("impacto", m.Origem);

            using var db = f.NovoDb();
            var al = db.Alertas.Single(x => x.OcorrenciaId == m.OcorrenciaId);
            Assert.Equal(f.Tempo.GetUtcNow().UtcDateTime, al.DisparadoEm);   // a escalada de 60 s conta daqui
            Assert.Equal(0, await ProcessarAsync());                          // segundo ciclo não repete o alerta
        }
        finally
        {
            await hub.DisposeAsync();
            await v.Cliente.PostAsync($"/api/v1/ocorrencias/{(await v.Cliente.GetFromJsonAsync<JsonElement[]>("/api/v1/ocorrencias"))![0].GetProperty("id").GetGuid()}/cancelar", null);
        }
    }
}
