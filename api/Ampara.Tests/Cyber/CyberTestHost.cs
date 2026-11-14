using Ampara.Api.Cyber;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Ampara.Tests.Cyber;

/// <summary>Rastro de segurança em memória: guarda os eventos para o teste conferir.</summary>
public sealed class RastroEmMemoria : IRastroSeguranca
{
    public List<EventoSeguranca> Eventos { get; } = [];
    public void Registrar(EventoSeguranca e) { lock (Eventos) Eventos.Add(e); }
}

/// <summary>
/// Host de teste (TestServer) só com o pipeline do Cyber: AddCyber/UseCyber, rastro em memória e os endpoints do
/// teste. As próximas tarefas do plano 03 estendem este helper (tradutor de risco falso etc.).
/// </summary>
public sealed class CyberTestHost : IAsyncDisposable
{
    // 32 bytes de teste em base64 (valor falso, só para a suíte).
    private static readonly string ChaveTeste = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());

    private readonly IHost _host;
    public RastroEmMemoria Rastro { get; }
    public IServiceProvider Services => _host.Services;

    private CyberTestHost(IHost host, RastroEmMemoria rastro) { _host = host; Rastro = rastro; }

    public HttpClient GetTestClient() => _host.GetTestClient();

    public static async Task<CyberTestHost> IniciarAsync(
        Action<IEndpointRouteBuilder> mapa, Action<IServiceCollection>? servicos = null, Dictionary<string, string?>? config = null)
    {
        var rastro = new RastroEmMemoria();
        var host = new HostBuilder()
            .ConfigureWebHost(web =>
            {
                web.UseTestServer();
                web.ConfigureAppConfiguration(c =>
                {
                    var baseCfg = new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = ChaveTeste };
                    foreach (var (k, v) in config ?? []) baseCfg[k] = v;
                    c.AddInMemoryCollection(baseCfg);
                });
                web.ConfigureServices((ctx, s) =>
                {
                    s.AddRouting();
                    s.AddCyber(ctx.Configuration);
                    s.AddSingleton<IRastroSeguranca>(rastro);
                    servicos?.Invoke(s);
                });
                web.Configure(app =>
                {
                    app.UseCyber();
                    app.UseRouting();
                    app.UseEndpoints(e => mapa(e));
                });
            })
            .Build();
        await host.StartAsync();
        return new CyberTestHost(host, rastro);
    }

    public async ValueTask DisposeAsync()
    {
        await _host.StopAsync();
        _host.Dispose();
    }
}
