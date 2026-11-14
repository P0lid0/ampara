using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ampara.Tests.Cyber;

/// <summary>Tradutor falso: frase fixa, sem rede nem chave.</summary>
public sealed class TradutorRiscoFalso : ITradutorRisco
{
    public const string Frase = "Frase de teste para o cidadao. Segunda frase de teste.";
    public Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default) => Task.FromResult(Frase);
}

/// <summary>
/// Rastro síncrono: guarda o evento na lista (para o teste conferir) e o grava no repositório, num escopo próprio.
/// Sem fila nem worker, o evento já existe quando a resposta HTTP volta.
/// </summary>
public sealed class RastroSincrono(IServiceScopeFactory escopos) : IRastroSeguranca
{
    public ConcurrentQueue<EventoSeguranca> Eventos { get; } = new();

    public void Registrar(EventoSeguranca e)
    {
        Eventos.Enqueue(e);
        try
        {
            using var escopo = escopos.CreateScope();
            var tradutor = escopo.ServiceProvider.GetService<ITradutorRisco>();
            if (tradutor is not null) e.MensagemCidadao = tradutor.TraduzirAsync(EventoTecnico.De(e)).GetAwaiter().GetResult();
            escopo.ServiceProvider.GetRequiredService<IEventoSegurancaRepository>().AdicionarAsync(e).GetAwaiter().GetResult();
        }
        catch { /* o rastro nunca derruba quem o chama */ }
    }
}

/// <summary>Provedor de log que guarda cada linha formatada, para provar que o IMEI não chega ao log.</summary>
public sealed class LogCapturado : ILoggerProvider
{
    public ConcurrentQueue<string> Linhas { get; } = new();
    public ILogger CreateLogger(string categoria) => new L(Linhas);
    public void Dispose() { }

    private sealed class L(ConcurrentQueue<string> linhas) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => linhas.Enqueue(formatter(state, exception) + (exception is null ? "" : " " + exception));
    }
}

/// <summary>
/// Host real da API (Program) para os testes do Cyber: DbContext em InMemory, tradutor falso, rastro síncrono que
/// também grava no repositório, AMPARA_DEMO=true e chave de cifra de teste. Workers e MQTT não rodam.
/// </summary>
public sealed class CyberApiFactory : WebApplicationFactory<Program>
{
    private static readonly string ChaveTeste = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO
    private readonly string _banco = "cyber-" + Guid.NewGuid().ToString("N");
    private readonly InMemoryDatabaseRoot _raiz = new();

    public LogCapturado Log { get; } = new();

    /// <summary>Eventos registrados desde que a fábrica subiu (a mesma instância que o host usa).</summary>
    public RastroSincrono Rastro => Services.GetRequiredService<RastroSincrono>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AMPARA_JWT_SECRET"] = new string('s', 64) + "-segredo-falso-de-teste",
            ["AMPARA_CRYPTO_KEY"] = ChaveTeste,
            ["AMPARA_DEMO"] = "true",
            ["AMPARA_DB"] = "Host=localhost;Database=teste;Username=teste;Password=falsa",
            ["PONTE_URL"] = "http://ponte.invalid",
            ["PONTE_CHAVE_SERVICO"] = "chave-teste-sintetica",
            ["MQTT_HOST"] = "127.0.0.1",
            ["MQTT_PORT"] = "1883",
            ["RISCO_CSV"] = "risco-teste.csv",
            ["Delegacias:Arquivo"] = Path.Combine(AppContext.BaseDirectory, "Fixtures", "delegacias-teste.json"),
        }));

        builder.ConfigureLogging(l => l.AddProvider(Log));

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AmparaDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AmparaDbContext>>();
            services.AddDbContext<AmparaDbContext>((sp, o) => o
                .UseInMemoryDatabase(_banco, _raiz)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .AddInterceptors(sp.GetRequiredService<Ampara.Infrastructure.Cyber.TaintSaveChangesInterceptor>()));

            services.RemoveAll<ITradutorRisco>();
            services.AddSingleton<ITradutorRisco, TradutorRiscoFalso>();
            services.AddSingleton<RastroSincrono>();
            services.RemoveAll<IRastroSeguranca>();
            services.AddSingleton<IRastroSeguranca>(sp => sp.GetRequiredService<RastroSincrono>());

            var hospedados = services.Where(d => d.ServiceType == typeof(IHostedService)
                && (d.ImplementationType?.Namespace?.StartsWith("Ampara.") == true
                    || d.ImplementationInstance?.GetType().Namespace?.StartsWith("Ampara.") == true
                    || d.ImplementationFactory is not null && d.ImplementationFactory.Method.DeclaringType?.Namespace?.StartsWith("Ampara.") == true))
                .ToList();
            foreach (var d in hospedados) services.Remove(d);
        });
    }

    /// <summary>Eventos gravados no repositório (banco InMemory) para um usuário alvo.</summary>
    public async Task<IReadOnlyList<EventoSeguranca>> EventosNoBancoAsync(Guid usuarioAlvoId)
    {
        using var escopo = Services.CreateScope();
        return await escopo.ServiceProvider.GetRequiredService<IEventoSegurancaRepository>()
            .DesdeAsync(DateTimeOffset.MinValue, usuarioAlvoId);
    }

    public AmparaDbContext NovoDb()
    {
        var escopo = Services.CreateScope();
        _escopos.Add(escopo);
        return escopo.ServiceProvider.GetRequiredService<AmparaDbContext>();
    }

    private readonly ConcurrentBag<IServiceScope> _escopos = new();

    protected override void Dispose(bool disposing)
    {
        if (disposing) foreach (var e in _escopos) e.Dispose();
        base.Dispose(disposing);
    }
}

public sealed record VitimaCyber(Guid UsuarioId, string Email, HttpClient Cliente, Guid OcorrenciaId);
public sealed record UsuarioCyber(Guid UsuarioId, string Email, HttpClient Cliente);

/// <summary>Monta cenários só com rotas do contrato (nada de escrever direto no banco).</summary>
public static class CyberTestHelpers
{
    public const string Imei = "490154203237518";   // SINTETICO (Luhn valido)
    public const string CodigoEmergencia = "123456";   // SINTETICO
    public const string PalavraSecreta = "palavra-sintetica";   // SINTETICO
    public const string Senha = "senha-sintetica-1";   // SINTETICO

    public static async Task<UsuarioCyber> CriarUsuarioAsync(HttpClient c, string nome = "Pessoa Teste")
    {
        var email = $"u{Guid.NewGuid():N}@ampara.demo";
        var reg = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome, email, senha = Senha });
        reg.EnsureSuccessStatusCode();
        var id = (await reg.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("usuarioId").GetGuid();
        var login = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, senha = Senha });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return new UsuarioCyber(id, email, c);
    }

    /// <summary>Cria a vítima (registrar, login, emergência, aparelho com IMEI), dispara o gatilho web com o token de emergência e marca o momento.</summary>
    public static async Task<VitimaCyber> CriarVitimaComOcorrenciaAsync(HttpClient cliente)
    {
        var u = await CriarUsuarioAsync(cliente, "Vitima Teste");
        (await cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = CodigoEmergencia, palavraSecreta = PalavraSecreta })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = Imei, marca = "MarcaTeste", modelo = "ModeloTeste" })).EnsureSuccessStatusCode();

        var r = await cliente.PostAsJsonAsync("/api/v1/auth/emergencia", new { email = u.Email, codigo = CodigoEmergencia, palavraSecreta = PalavraSecreta });
        r.EnsureSuccessStatusCode();
        var token = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        var web = new HttpRequestMessage(HttpMethod.Post, "/api/v1/ocorrencias/gatilho") { Content = JsonContent.Create(new { origem = "web" }) };
        web.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var g = await cliente.SendAsync(web);
        g.EnsureSuccessStatusCode();
        var id = (await g.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ocorrenciaId").GetGuid();

        var m = await cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = DateTime.UtcNow.AddMinutes(-5), lat = -23.5672490, lng = -46.7019515 });
        m.EnsureSuccessStatusCode();
        return new VitimaCyber(u.UsuarioId, u.Email, cliente, id);
    }
}
