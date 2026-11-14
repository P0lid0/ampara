using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Chaveiros;
using Ampara.Application.Cyber;
using Ampara.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Time.Testing;

namespace Ampara.Tests.Infra;

public record Sessao(Guid UsuarioId, string Email, HttpClient Cliente);

public class AmparaFactory : WebApplicationFactory<Program>
{
    // 32 bytes de teste em base64 (valor falso, só para a suíte).
    private static readonly string ChaveTeste = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());

    private readonly string _jwtSecret;
    // SQLite em memória compartilhada: a conexão fica aberta enquanto a fábrica viver.
    private readonly SqliteConnection _conexao = new($"DataSource=file:ampara-{Guid.NewGuid():N}?mode=memory&cache=shared");

    // xUnit exige um único construtor público na fixture; o de segredo é interno (mesmo assembly dos testes).
    public AmparaFactory() : this(jwtSecret: null) { }

    internal AmparaFactory(string? jwtSecret)
    {
        _jwtSecret = jwtSecret ?? new string('s', 64) + "-segredo-falso-de-teste";
        _conexao.Open();
    }

    public AcessoIndevidoSpy Acesso { get; } = new();

    public FakeChaveiroGateway Gateway { get; } = new();

    public FakeTimeProvider Tempo { get; } = new(new DateTimeOffset(2026, 11, 14, 12, 0, 0, TimeSpan.Zero));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AMPARA_JWT_SECRET"] = _jwtSecret,
            ["AMPARA_CRYPTO_KEY"] = ChaveTeste,
            ["AMPARA_DEMO"] = "false",
            ["AMPARA_DB"] = "Host=localhost;Database=teste;Username=teste;Password=falsa",
            ["MQTT_HOST"] = "127.0.0.1",
            ["MQTT_PORT"] = "1883",
            ["RISCO_CSV"] = "risco-teste.csv",
        }));

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Tempo);
            services.RemoveAll<IAcessoIndevido>();
            services.AddSingleton<IAcessoIndevido>(Acesso);
            services.RemoveAll<IChaveiroGateway>();
            services.AddSingleton<IChaveiroGateway>(Gateway);

            // Troca o Npgsql por SQLite em memória (o esquema vem do modelo, via EnsureCreated).
            services.RemoveAll<DbContextOptions<AmparaDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AmparaDbContext>>();
            services.AddDbContext<AmparaDbContext>(o => o.UseSqlite(_conexao));

            // Workers e MQTT não rodam nos testes: remove todo IHostedService de Ampara.*
            var hospedados = services.Where(d => d.ServiceType == typeof(IHostedService)
                && (d.ImplementationType?.Namespace?.StartsWith("Ampara.") == true
                    || d.ImplementationInstance?.GetType().Namespace?.StartsWith("Ampara.") == true
                    || d.ImplementationFactory is not null && d.ImplementationFactory.Method.DeclaringType?.Namespace?.StartsWith("Ampara.") == true))
                .ToList();
            foreach (var d in hospedados) services.Remove(d);
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var escopo = host.Services.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<AmparaDbContext>();
        db.Database.EnsureCreated();
        Ampara.Infrastructure.Dados.CatalogoSeeder
            .SemearAsync(db, Path.Combine(AppContext.BaseDirectory, "Fixtures", "catalogo-teste.json"), CancellationToken.None)
            .GetAwaiter().GetResult();
        return host;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) foreach (var e in _escopos) e.Dispose();
        base.Dispose(disposing);
        if (disposing) _conexao.Dispose();
    }

    private readonly System.Collections.Concurrent.ConcurrentBag<IServiceScope> _escopos = new();

    /// <summary>Um AmparaDbContext em escopo novo (os escopos são descartados junto com a fábrica).</summary>
    public AmparaDbContext NovoDb()
    {
        var escopo = Services.CreateScope();
        _escopos.Add(escopo);
        return escopo.ServiceProvider.GetRequiredService<AmparaDbContext>();
    }

    private const string SenhaPadrao = "senha-sintetica-1";   // SINTETICO

    /// <summary>Registra e loga um usuário novo; o cliente devolvido já leva o cabeçalho Bearer.</summary>
    public async Task<Sessao> NovoUsuarioAsync(string nome = "Pessoa Teste", string? email = null)
    {
        email ??= $"u{Guid.NewGuid():N}@ampara.demo";
        var c = CreateClient();
        var reg = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome, email, senha = SenhaPadrao });
        reg.EnsureSuccessStatusCode();
        var id = (await reg.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("usuarioId").GetGuid();
        var login = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, senha = SenhaPadrao });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return new Sessao(id, email.Trim().ToLowerInvariant(), c);
    }

    /// <summary>Cria um usuario novo e o vincula como guardiao da vitima (convite criado e aceito). Devolve a sessao do guardiao.</summary>
    public async Task<Sessao> VincularGuardiaoAsync(Sessao vitima)
    {
        var g = await NovoUsuarioAsync("Guardiao " + Guid.NewGuid().ToString("N")[..6]);
        var cv = await (await vitima.Cliente.PostAsync("/api/v1/guardioes/convites", null)).Content.ReadFromJsonAsync<JsonElement>();
        var r = await g.Cliente.PostAsync($"/api/v1/guardioes/convites/{cv.GetProperty("codigo").GetString()}/aceitar", null);
        r.EnsureSuccessStatusCode();
        return g;
    }

    /// <summary>Entra pelo codigo de emergencia; o cliente devolvido leva o Bearer com scope=emergencia.</summary>
    public async Task<HttpClient> ClienteEmergenciaAsync(string email, string codigo, string palavra)
    {
        var c = CreateClient();
        var r = await c.PostAsJsonAsync("/api/v1/auth/emergencia", new { email, codigo, palavraSecreta = palavra });
        r.EnsureSuccessStatusCode();
        var token = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return c;
    }
}
