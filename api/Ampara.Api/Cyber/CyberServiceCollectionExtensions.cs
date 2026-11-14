using Ampara.Api.Middleware;
using Ampara.Application.Cyber;
using Ampara.Infrastructure.Cyber;
using Ampara.Infrastructure.Cyber.Detectores;
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
        services.TryAddScoped<ICorrelacao>(sp => sp.GetRequiredService<Correlacao>());
        services.TryAddScoped<Correlacao>();

        // UseExceptionHandler precisa de um destino mesmo em hosts sem o ProblemaHandler.
        services.AddProblemDetails();
        return services;
    }

    /// <summary>Ordem fixa: Correlacao, UseExceptionHandler, PiiRequest. Os demais passos do plano 03 entram depois.</summary>
    public static IApplicationBuilder UseCyber(this IApplicationBuilder app)
    {
        app.UseMiddleware<CorrelacaoMiddleware>();
        app.UseExceptionHandler();
        app.UseMiddleware<PiiRequestMiddleware>();
        return app;
    }
}
