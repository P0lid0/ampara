using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
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

    public FakeTimeProvider Tempo { get; } = new(new DateTimeOffset(2026, 11, 14, 12, 0, 0, TimeSpan.Zero));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AMPARA_JWT_SECRET"] = new string('s', 64) + "-segredo-falso-de-teste",
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

            // Workers e MQTT não rodam nos testes: remove todo IHostedService de Ampara.*
            var hospedados = services.Where(d => d.ServiceType == typeof(IHostedService)
                && (d.ImplementationType?.Namespace?.StartsWith("Ampara.") == true
                    || d.ImplementationInstance?.GetType().Namespace?.StartsWith("Ampara.") == true
                    || d.ImplementationFactory is not null && d.ImplementationFactory.Method.DeclaringType?.Namespace?.StartsWith("Ampara.") == true))
                .ToList();
            foreach (var d in hospedados) services.Remove(d);
        });
    }

    // Completado na T4.
    public Task<Sessao> NovoUsuarioAsync(string nome = "Pessoa Teste", string? email = null)
        => throw new NotImplementedException("Completado na T4 (registro e login).");

    // Completado na T5.
    public Task<HttpClient> ClienteEmergenciaAsync(string email, string codigo, string palavra)
        => throw new NotImplementedException("Completado na T5 (acesso de emergência).");
}
