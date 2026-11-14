using Ampara.Application.Auth;
using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Infrastructure.Cripto;
using Ampara.Infrastructure.Cyber;
using Ampara.Infrastructure.Mqtt;
using Ampara.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Lida de forma preguiçosa (config final do host, inclusive a de testes). Program.cs resolve
        // ICifrador e ITokenService logo após o Build: ausente ou inválido derruba a subida.
        services.AddSingleton<ICifrador>(sp =>
        {
            var chave = sp.GetRequiredService<IConfiguration>()["AMPARA_CRYPTO_KEY"];
            if (string.IsNullOrWhiteSpace(chave))
                throw new InvalidOperationException("AMPARA_CRYPTO_KEY ausente (base64 de 32 bytes).");
            return new CifradorAesGcm(chave);
        });
        services.AddSingleton<ISenhaHasher, SenhaHasherPbkdf2>();
        services.AddSingleton<ITokenService>(sp =>
            new TokenService(sp.GetRequiredService<IConfiguration>()["AMPARA_JWT_SECRET"], sp.GetRequiredService<TimeProvider>()));

        services.AddDbContext<AmparaDbContext>((sp, o) => o.UseNpgsql(StringDeConexao(sp.GetRequiredService<IConfiguration>())));
        services.AddScoped<IAmparaDb>(sp => sp.GetRequiredService<AmparaDbContext>());

        services.AddSingleton<IImeiRevelador, NoopImeiRevelador>();
        services.AddSingleton<ITaintGuard, NoopTaintGuard>();
        services.AddSingleton<IAcessoIndevido, NoopAcessoIndevido>();
        // Gateway real (MQTT) entra na T15; ate la, desconectado.
        services.AddSingleton<IChaveiroGateway, GatewayChaveiroDesconectado>();
        return services;
    }

    public static string StringDeConexao(IConfiguration cfg)
    {
        var s = cfg["AMPARA_DB"];
        if (string.IsNullOrWhiteSpace(s)) throw new InvalidOperationException("AMPARA_DB ausente (string de conexao do PostgreSQL).");
        return s;
    }
}
