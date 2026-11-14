using Ampara.Application.Alertas;
using Ampara.Application.Aparelhos;
using Ampara.Application.Auth;
using Ampara.Application.Bo;
using Ampara.Application.Chaveiros;
using Ampara.Application.Contas;
using Ampara.Application.Guardioes;
using Ampara.Application.Ocorrencias;
using Ampara.Application.Policia;
using Ampara.Application.Relatos;
using Ampara.Application.Rota;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Application;

public static class DependencyInjection
{
    /// <summary>Serviços da camada de aplicação. Cresce nas próximas tarefas.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAparelhoService, AparelhoService>();
        services.AddScoped<IContaService, ContaService>();
        services.AddScoped<IGuardiaoService, GuardiaoService>();
        services.AddScoped<IChaveiroService, ChaveiroService>();
        services.AddScoped<IChaveiroEventoService, ChaveiroEventoService>();
        services.AddScoped<IRotaService, RotaService>();
        services.AddScoped<IOcorrenciaService, OcorrenciaService>();
        services.AddScoped<IBoGenerator, BoGenerator>();
        services.AddScoped<IPoliciaService, PoliciaService>();
        services.AddScoped<IRelatoService, RelatoService>();
        services.AddSingleton(new OpcoesEscalonamento());
        services.AddScoped<IEscalonamento, Escalonamento>();
        return services;
    }
}
