using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Alertas;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests.Infra;

/// <summary>Vítima V com guardiões A(1), B(2), C(3), os três com hub conectado, e a ocorrência já disparada pela web.</summary>
public sealed class CenarioAlerta : IAsyncDisposable
{
    private const string Codigo = "123456";
    private const string Palavra = "palavra-sintetica";   // SINTETICO

    public required AmparaFactory F { get; init; }
    public required Sessao V { get; init; }
    public required Sessao A { get; init; }
    public required Sessao B { get; init; }
    public required Sessao C { get; init; }
    public required Guid GuardiaoA { get; init; }
    public required Guid GuardiaoB { get; init; }
    public required Guid GuardiaoC { get; init; }
    public Guid OcorrenciaId { get; private set; }
    public HttpClient Emergencia { get; private set; } = null!;

    public Eventos EventosA { get; } = new();
    public Eventos EventosB { get; } = new();
    public Eventos EventosC { get; } = new();
    private readonly List<HubConnection> _hubs = [];

    public sealed class Eventos
    {
        public ConcurrentQueue<AlertaDisparadoMsg> Disparados { get; } = new();
        public ConcurrentQueue<AlertaEscaladoMsg> Escalados { get; } = new();
        public ConcurrentQueue<AlertaEncerradoMsg> Encerrados { get; } = new();
        public ConcurrentQueue<PassoAtualizadoMsg> Passos { get; } = new();
    }

    public static async Task<CenarioAlerta> CriarAsync(AmparaFactory f)
    {
        var v = await f.NovoUsuarioAsync("Vitima Teste");
        var a = await f.VincularGuardiaoAsync(v); var b = await f.VincularGuardiaoAsync(v); var c = await f.VincularGuardiaoAsync(v);
        var lista = await v.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/guardioes");
        Guid Id(int ordem) => lista.EnumerateArray().Single(x => x.GetProperty("ordem").GetInt32() == ordem).GetProperty("guardiaoId").GetGuid();
        var s = new CenarioAlerta { F = f, V = v, A = a, B = b, C = c, GuardiaoA = Id(1), GuardiaoB = Id(2), GuardiaoC = Id(3) };
        await s.ConectarAsync(a, s.EventosA); await s.ConectarAsync(b, s.EventosB); await s.ConectarAsync(c, s.EventosC);
        (await v.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).EnsureSuccessStatusCode();
        s.Emergencia = await f.ClienteEmergenciaAsync(v.Email, Codigo, Palavra);
        var r = await s.Emergencia.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        r.EnsureSuccessStatusCode();
        s.OcorrenciaId = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ocorrenciaId").GetGuid();
        return s;
    }

    private async Task ConectarAsync(Sessao s, Eventos e)
    {
        var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(F.Server.BaseAddress, "/hubs/guardiao"), o =>
            {
                o.HttpMessageHandlerFactory = _ => F.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.AccessTokenProvider = () => Task.FromResult<string?>(s.Token);
            }).Build();
        hub.On<AlertaDisparadoMsg>("AlertaDisparado", m => e.Disparados.Enqueue(m));
        hub.On<AlertaEscaladoMsg>("AlertaEscalado", m => e.Escalados.Enqueue(m));
        hub.On<AlertaEncerradoMsg>("AlertaEncerrado", m => e.Encerrados.Enqueue(m));
        hub.On<PassoAtualizadoMsg>("PassoAtualizado", m => e.Passos.Enqueue(m));
        await hub.StartAsync();
        _hubs.Add(hub);
    }

    public async Task<int> ProcessarAsync()
    {
        using var escopo = F.Services.CreateScope();
        return await escopo.ServiceProvider.GetRequiredService<IEscalonamento>().ProcessarVencidosAsync(CancellationToken.None);
    }

    public static async Task<T> EsperarAsync<T>(ConcurrentQueue<T> fila, int quantos = 1)
    {
        var limite = DateTime.UtcNow.AddSeconds(5);
        while (fila.Count < quantos && DateTime.UtcNow < limite) await Task.Delay(25);
        Assert.True(fila.Count >= quantos, $"esperava {quantos} evento(s), chegaram {fila.Count}");
        return fila.ToArray()[quantos - 1];
    }

    /// <summary>Espera um pouco para provar que nada mais chega.</summary>
    public static Task SilencioAsync() => Task.Delay(300);

    public async ValueTask DisposeAsync()
    {
        foreach (var h in _hubs) await h.DisposeAsync();
        // Fecha a ocorrência (se ainda aberta) para ela não ser escalada pelos outros testes da mesma fábrica.
        await V.Cliente.PostAsync($"/api/v1/ocorrencias/{OcorrenciaId}/cancelar", null);
    }
}
