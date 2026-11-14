using Ampara.Application.Auth;
using Ampara.Application.Bo;
using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Application.Risco;
using Ampara.Infrastructure.Cripto;
using Ampara.Infrastructure.Cyber;
using Ampara.Infrastructure.Dados;
using Ampara.Infrastructure.Mqtt;
using Ampara.Infrastructure.Ponte;
using Ampara.Infrastructure.Risco;
using Ampara.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

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
        services.AddSingleton<MqttChaveiroGateway>();
        services.AddSingleton<IChaveiroGateway>(sp => sp.GetRequiredService<MqttChaveiroGateway>());
        services.AddHostedService(sp => sp.GetRequiredService<MqttChaveiroGateway>());
        services.AddPontePolicia();
        services.AddSingleton<ISondaSaude, SondaSaude>();
        services.AddSingleton<RiscoService>();
        services.AddSingleton<IRiscoService>(sp => sp.GetRequiredService<RiscoService>());
        services.AddHostedService<RiscoInicializador>();

        // Delegacias do BO: Delegacias:Arquivo (padrão Dados/delegacias.json), relativo à pasta da aplicação.
        services.AddSingleton<IDelegaciaLocator>(sp =>
        {
            var arquivo = sp.GetRequiredService<IConfiguration>()["Delegacias:Arquivo"];
            if (string.IsNullOrWhiteSpace(arquivo)) arquivo = Path.Combine("Dados", "delegacias.json");
            return new DelegaciaJsonLocator(Path.Combine(AppContext.BaseDirectory, arquivo), sp.GetRequiredService<ILoggerFactory>().CreateLogger<DelegaciaJsonLocator>());
        });
        services.AddSingleton(sp => new CamadasMapa(Path.Combine(AppContext.BaseDirectory, "Dados"), sp.GetRequiredService<ILoggerFactory>().CreateLogger<CamadasMapa>()));
        return services;
    }

    public static string StringDeConexao(IConfiguration cfg)
    {
        var s = cfg["AMPARA_DB"];
        if (string.IsNullOrWhiteSpace(s)) throw new InvalidOperationException("AMPARA_DB ausente (string de conexao do PostgreSQL).");
        return s;
    }
}
