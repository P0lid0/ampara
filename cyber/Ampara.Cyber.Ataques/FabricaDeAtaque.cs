using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure;
using Ampara.Tests.Cyber;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
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

namespace Ampara.Cyber.Ataques;

// RastroSincrono, LogCapturado e CyberTestHelpers vem de api/Ampara.Tests/Cyber/CyberApiFactory.cs (compartilhado por link no csproj).

/// <summary>
/// Rede de mentira, no fim da cadeia de todo HttpClient (depois do handler de taint): guarda o que de fato SAIRIA da API.
/// O Claude responde com uma frase fixa; os demais hosts respondem 200 vazio.
/// </summary>
public sealed class SaidaDeRede : HttpMessageHandler
{
    public const string FraseDoClaude = "Frase de teste da IA sobre o aviso. Segunda frase de teste para o cidadao.";
    public ConcurrentQueue<(Uri Url, string Corpo)> Pedidos { get; } = new();

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var corpo = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
        Pedidos.Enqueue((request.RequestUri!, corpo));
        var json = request.RequestUri!.Host == "api.anthropic.com"
            ? JsonSerializer.Serialize(new { content = new[] { new { type = "text", text = FraseDoClaude } } })
            : "{}";
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }
}

/// <summary>
/// Host real da API (Program) para a suíte de ataques: só o banco (InMemory), o Claude e a rede são falsos.
/// Pipeline Cyber, guard, logger protegido, handlers de taint, hub e tradutor são os de produção.
/// Acrescenta rotas de ataque ATRÁS do pipeline (/eco, /eco-log, /explode), como um endpoint descuidado de um dev faria.
/// </summary>
public sealed class FabricaDeAtaque(Dictionary<string, string?>? config = null) : WebApplicationFactory<Program>
{
    private static readonly string ChaveTeste = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO
    private readonly string _banco = "ataque-" + Guid.NewGuid().ToString("N");
    private readonly InMemoryDatabaseRoot _raiz = new();

    public LogCapturado Log { get; } = new();
    public SaidaDeRede Rede { get; } = new();

    /// <summary>Eventos registrados desde que a fábrica subiu (a mesma instância que o host usa).</summary>
    public RastroSincrono Rastro => Services.GetRequiredService<RastroSincrono>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AMPARA_JWT_SECRET"] = new string('s', 64) + "-segredo-falso-de-teste",
                ["AMPARA_CRYPTO_KEY"] = ChaveTeste,
                ["AMPARA_DEMO"] = "true",
                ["AMPARA_DB"] = "Host=localhost;Database=teste;Username=teste;Password=falsa",
                ["PONTE_URL"] = "http://ponte.invalid",
                ["PONTE_CHAVE_SERVICO"] = "chave-teste-sintetica",
                ["ANTHROPIC_API_KEY"] = "chave-falsa-de-teste",   // SINTETICO: a rede é a SaidaDeRede, nada sai de verdade
                ["MQTT_HOST"] = "127.0.0.1",
                ["MQTT_PORT"] = "1883",
                ["RISCO_CSV"] = "risco-teste.csv",
                ["Delegacias:Arquivo"] = Path.Combine(AppContext.BaseDirectory, "Fixtures", "delegacias-teste.json"),
            });
            if (config is not null) cfg.AddInMemoryCollection(config);
        });

        // Produção de verdade: em Development o minimal API relança o 400 de JSON inválido e ele viraria 500 no handler de erros.
        builder.UseEnvironment("Production");
        builder.ConfigureLogging(l => l.AddProvider(Log));

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AmparaDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AmparaDbContext>>();
            services.AddDbContext<AmparaDbContext>((sp, o) => o
                .UseInMemoryDatabase(_banco, _raiz)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .AddInterceptors(sp.GetRequiredService<Ampara.Infrastructure.Cyber.TaintSaveChangesInterceptor>()));

            services.AddSingleton<RastroSincrono>();
            services.RemoveAll<IRastroSeguranca>();
            services.AddSingleton<IRastroSeguranca>(sp => sp.GetRequiredService<RastroSincrono>());

            // Depois do handler de taint (registrado em AddCyber): o que chega aqui é o que sairia pela rede.
            services.ConfigureHttpClientDefaults(b => b.ConfigurePrimaryHttpMessageHandler(() => Rede));

            services.AddSingleton<IStartupFilter, RotasDeAtaque>();

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

    /// <summary>
    /// Rotas "descuidadas" no fim do pipeline: o que o time de produto poderia escrever sem pensar em PII.
    /// Rodam depois de UseCyber e da autenticação, então valem as mesmas defesas que valem para as rotas reais.
    /// </summary>
    private sealed class RotasDeAtaque : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            app.Use(async (ctx, prox) =>
            {
                switch (ctx.Request.Path.Value)
                {
                    case "/eco":   // devolve o corpo como veio, para quem chamar (anônimo ou não)
                    {
                        using var leitor = new StreamReader(ctx.Request.Body, Encoding.UTF8);
                        var corpo = await leitor.ReadToEndAsync();
                        ctx.Response.ContentType = ctx.Request.ContentType ?? "application/json";
                        await ctx.Response.WriteAsync(corpo);
                        return;
                    }
                    case "/eco-log":   // "registra tudo que chegou para depurar": query, cabeçalho e formulário
                    {
                        var log = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Ataque.EcoLog");
                        var form = ctx.Request.HasFormContentType ? await ctx.Request.ReadFormAsync() : null;
                        log.LogInformation("recebido query={Query} cabecalho={Cabecalho} form={Form} documento={Documento}",
                            ctx.Request.QueryString.Value, ctx.Request.Headers["X-Documento"].ToString(),
                            form is null ? "" : string.Join("&", form.Select(p => p.Key + "=" + p.Value)),
                            ctx.Request.Query["cpf"].ToString());
                        ctx.Response.StatusCode = StatusCodes.Status204NoContent;
                        return;
                    }
                    case "/explode":   // exceção cuja mensagem carrega laudo e CPF, como um "catch e relança com contexto"
                        throw new InvalidOperationException("falha ao salvar laudo medico do paciente: diagnostico F32 para 529.982.247-25");   // SINTETICO
                    default:
                        await prox(ctx);
                        return;
                }
            });
        };
    }
}
