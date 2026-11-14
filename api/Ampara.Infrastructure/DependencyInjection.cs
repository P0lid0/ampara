using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Infrastructure.Cripto;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Lida de forma preguiçosa (config final do host, inclusive a de testes). Program.cs resolve
        // ICifrador logo após o Build: ausente ou diferente de 32 bytes derruba a subida.
        services.AddSingleton<ICifrador>(sp =>
        {
            var chave = sp.GetRequiredService<IConfiguration>()["AMPARA_CRYPTO_KEY"];
            if (string.IsNullOrWhiteSpace(chave))
                throw new InvalidOperationException("AMPARA_CRYPTO_KEY ausente (base64 de 32 bytes).");
            return new CifradorAesGcm(chave);
        });
        services.AddSingleton<IImeiRevelador, NoopImeiRevelador>();
        services.AddSingleton<ITaintGuard, NoopTaintGuard>();
        services.AddSingleton<IAcessoIndevido, NoopAcessoIndevido>();
        return services;
    }
}
