using Ampara.Application.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<ITaintGuard, NoopTaintGuard>();
        services.AddSingleton<IAcessoIndevido, NoopAcessoIndevido>();
        return services;
    }
}
