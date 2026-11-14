using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Application;

public static class DependencyInjection
{
    /// <summary>Serviços da camada de aplicação. Cresce nas próximas tarefas.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services) => services;
}
