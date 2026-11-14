using System.Net.Http.Json;
using Ampara.Application.Alertas;
using Ampara.Tests.Infra;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class HubTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private HubConnection Conectar(string? token) => new HubConnectionBuilder()
        .WithUrl(new Uri(f.Server.BaseAddress, "/hubs/guardiao"), o =>
        {
            o.HttpMessageHandlerFactory = _ => f.Server.CreateHandler();
            o.Transports = HttpTransportType.LongPolling;
            if (token is not null) o.AccessTokenProvider = () => Task.FromResult<string?>(token);
        })
        .Build();

    private IGuardiaoNotificador Notificador => f.Services.GetRequiredService<IGuardiaoNotificador>();

    [Fact]
    public async Task Sem_token_nao_conecta()
    {
        await using var hub = Conectar(null);
        await Assert.ThrowsAnyAsync<Exception>(() => hub.StartAsync());
    }

    [Fact]
    public async Task Token_de_emergencia_nao_conecta()
    {
        var s = await f.NovoUsuarioAsync();
        await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "482915", palavraSecreta = "Girassol" });   // SINTETICO
        var token = await f.TokenEmergenciaAsync(s.Email, "482915", "Girassol");
        await using var hub = Conectar(token);
        await Assert.ThrowsAnyAsync<Exception>(() => hub.StartAsync());
    }

    [Fact]
    public async Task Alerta_chega_so_para_o_guardiao_destinatario()
    {
        var a = await f.NovoUsuarioAsync(); var b = await f.NovoUsuarioAsync();
        await using var hubA = Conectar(a.Token); await using var hubB = Conectar(b.Token);
        var recebido = new TaskCompletionSource<AlertaDisparadoMsg>(); var intruso = new TaskCompletionSource<bool>();
        hubA.On<AlertaDisparadoMsg>("AlertaDisparado", m => recebido.TrySetResult(m));
        hubB.On<AlertaDisparadoMsg>("AlertaDisparado", _ => intruso.TrySetResult(true));
        await hubA.StartAsync(); await hubB.StartAsync();
        var msg = new AlertaDisparadoMsg(Guid.NewGuid(), Guid.NewGuid(), "Vitima Teste", "chaveiro", DateTime.UtcNow);
        await Notificador.AlertaDisparadoAsync(a.UsuarioId, msg, default);
        Assert.Equal(msg.AlertaId, (await recebido.Task.WaitAsync(TimeSpan.FromSeconds(5))).AlertaId);
        await Task.Delay(300);
        Assert.False(intruso.Task.IsCompleted);
    }

    [Fact]
    public async Task Escalado_encerrado_e_passo_chegam_com_os_nomes_do_contrato()
    {
        var a = await f.NovoUsuarioAsync(); var b = await f.NovoUsuarioAsync();
        await using var hubA = Conectar(a.Token); await using var hubB = Conectar(b.Token);
        var esc = new TaskCompletionSource<System.Text.Json.JsonElement>();
        var enc = new TaskCompletionSource<AlertaEncerradoMsg>();
        var passoA = new TaskCompletionSource<PassoAtualizadoMsg>(); var passoB = new TaskCompletionSource<PassoAtualizadoMsg>();
        hubA.On<System.Text.Json.JsonElement>("AlertaEscalado", m => esc.TrySetResult(m));
        hubA.On<AlertaEncerradoMsg>("AlertaEncerrado", m => enc.TrySetResult(m));
        hubA.On<PassoAtualizadoMsg>("PassoAtualizado", m => passoA.TrySetResult(m));
        hubB.On<PassoAtualizadoMsg>("PassoAtualizado", m => passoB.TrySetResult(m));
        await hubA.StartAsync(); await hubB.StartAsync();
        var espera = TimeSpan.FromSeconds(5);

        var alerta = Guid.NewGuid(); var oc = Guid.NewGuid(); var guardiaoId = Guid.NewGuid();
        await Notificador.AlertaEscaladoAsync([a.UsuarioId], new AlertaEscaladoMsg(alerta, oc, guardiaoId, DateTime.UtcNow), default);
        var j = await esc.Task.WaitAsync(espera);
        Assert.Equal(guardiaoId, j.GetProperty("paraGuardiaoId").GetGuid());
        Assert.Equal(alerta, j.GetProperty("alertaId").GetGuid());
        Assert.Equal(oc, j.GetProperty("ocorrenciaId").GetGuid());
        Assert.True(j.TryGetProperty("em", out _));

        await Notificador.AlertaEncerradoAsync(a.UsuarioId, new AlertaEncerradoMsg(alerta, "ciente"), default);
        Assert.Equal("ciente", (await enc.Task.WaitAsync(espera)).Motivo);

        await Notificador.PassoAtualizadoAsync([a.UsuarioId, b.UsuarioId], new PassoAtualizadoMsg(oc, "bo", DateTime.UtcNow), default);
        Assert.Equal("bo", (await passoA.Task.WaitAsync(espera)).Passo);
        Assert.Equal(oc, (await passoB.Task.WaitAsync(espera)).OcorrenciaId);
    }
}
