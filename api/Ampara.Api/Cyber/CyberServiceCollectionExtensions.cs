using Ampara.Api.Middleware;
using Ampara.Application.Cyber;
using Ampara.Infrastructure.Cyber;
using Ampara.Infrastructure.Cyber.Detectores;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Ampara.Api.Cyber;

public static class CyberServiceCollectionExtensions
{
    public static IServiceCollection AddCyber(this IServiceCollection services, IConfiguration config)
    {
        services.AddOptions<CyberOptions>()
            .Configure(o =>
            {
                config.GetSection(CyberOptions.Secao).Bind(o);
                o.Demo = config.GetValue<bool>("AMPARA_DEMO");
                // O desligamento do taint só vale em demonstração; em produção é sempre ativo.
                if (!o.Demo) o.TaintAtivo = true;
            });

        // Detectores, scanner e protetor são singletons sem estado por requisição.
        services.TryAddEnumerable(
        [
            ServiceDescriptor.Singleton<IPiiDetector, CpfDetector>(), ServiceDescriptor.Singleton<IPiiDetector, RgDetector>(),
            ServiceDescriptor.Singleton<IPiiDetector, ImeiDetector>(), ServiceDescriptor.Singleton<IPiiDetector, TelefoneDetector>(),
            ServiceDescriptor.Singleton<IPiiDetector, EmailDetector>(), ServiceDescriptor.Singleton<IPiiDetector, PlacaDetector>(),
            ServiceDescriptor.Singleton<IPiiDetector, SenhaDetector>(), ServiceDescriptor.Singleton<IPiiDetector, SaudeDetector>(),
        ]);
        services.TryAddSingleton<IPiiScanner, PiiScanner>();
        services.TryAddSingleton<PiiProtetor>(sp => new PiiProtetor(sp.GetRequiredService<IConfiguration>()));
        services.TryAddSingleton<IPiiProtetor>(sp => sp.GetRequiredService<PiiProtetor>());

        services.TryAddScoped<ITaintScope, TaintScope>();
        services.AddHttpContextAccessor();
        // Acesso indevido real no lugar do no-op do plano 02. Singleton (há consumidores singleton), com correlação ambiente.
        services.RemoveAll<IAcessoIndevido>();
        services.AddSingleton<IAcessoIndevido>(sp => new AcessoIndevido(sp.GetRequiredService<IRastroSeguranca>(),
            new CorrelacaoAmbiente(sp.GetRequiredService<IHttpContextAccessor>())));
        // Revelador real do IMEI (grava Imei/HttpAutenticada/Permitido) no lugar do no-op do plano 02. Singleton, como o no-op.
        services.RemoveAll<IImeiRevelador>();
        services.AddSingleton<IImeiRevelador>(sp => new ImeiRevelador(sp.GetRequiredService<IPiiProtetor>(), sp.GetRequiredService<IRastroSeguranca>(),
            sp.GetRequiredService<IAcessoIndevido>(), new CorrelacaoAmbiente(sp.GetRequiredService<IHttpContextAccessor>()), sp.GetService<TimeProvider>()));
        // Registrado antes do ProblemaHandler (Program.cs chama AddCyber primeiro): assume só as exceções inesperadas.
        services.AddExceptionHandler<TaintExceptionHandler>();
        // Guard real no lugar do NoopTaintGuard do plano 02 (Scoped: depende do escopo e do usuario da requisicao).
        services.RemoveAll<ITaintGuard>();
        services.AddScoped<ITaintGuard, TaintGuard>();
        // Filtro de PII das mensagens MQTT: singleton (cria um escopo por mensagem para resolver o guard).
        services.TryAddSingleton<IMqttPiiFilter, MqttPiiFilter>();
        services.AddHttpClient("anthropic");
        // Sinks Ponte e Claude: todo HttpClient passa pelo handler, que decide o sink pelo host do pedido.
        services.AddTransient<TaintHttpHandler>();
        services.ConfigureHttpClientDefaults(b => b.AddHttpMessageHandler<TaintHttpHandler>());
        AddLogProtegido(services);
        services.AddMemoryCache();
        services.TryAddScoped<ITradutorRisco, ClaudeTradutorRisco>();   // Scoped: depende do guard
        services.TryAddScoped<ICorrelacao>(sp => sp.GetRequiredService<Correlacao>());
        services.TryAddScoped<Correlacao>();

        // UseExceptionHandler precisa de um destino mesmo em hosts sem o ProblemaHandler.
        services.AddProblemDetails();
        return services;
    }

    /// <summary>
    /// Troca o <see cref="ILoggerFactory"/> por um que embrulha o original e passa cada linha pelo guard (sink Log).
    /// Sem requisição em andamento usa um guard próprio com <see cref="TaintScope"/> vazio (só o scanner age).
    /// </summary>
    private static void AddLogProtegido(IServiceCollection services)
    {
        services.AddLogging();
        services.RemoveAll<ILoggerFactory>();
        services.AddSingleton<ILoggerFactory>(sp =>
        {
            var original = ActivatorUtilities.CreateInstance<LoggerFactory>(sp);
            TaintGuard? semEscopo = null;
            ITaintGuard Guard()
            {
                var daRequisicao = sp.GetService<IHttpContextAccessor>()?.HttpContext?.RequestServices.GetService<ITaintGuard>();
                if (daRequisicao is not null) return daRequisicao;
                return semEscopo ??= new TaintGuard(sp.GetRequiredService<IPiiScanner>(), new TaintScope(),
                    sp.GetRequiredService<IPiiProtetor>(), sp.GetRequiredService<IRastroSeguranca>(),
                    sp.GetRequiredService<IOptions<CyberOptions>>());
            }
            return new GuardedLoggerFactory(original, Guard);
        });
    }

    /// <summary>Ordem fixa: Correlacao, UseExceptionHandler, PiiRequest, RespostaNaoAutenticada. Os demais passos do plano 03 entram depois.</summary>
    public static IApplicationBuilder UseCyber(this IApplicationBuilder app)
    {
        app.UseMiddleware<CorrelacaoMiddleware>();
        app.UseExceptionHandler();
        app.UseMiddleware<PiiRequestMiddleware>();
        app.UseMiddleware<RespostaNaoAutenticadaMiddleware>();
        return app;
    }
}
