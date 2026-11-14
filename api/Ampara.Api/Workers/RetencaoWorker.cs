using Ampara.Application.Auth;
using Ampara.Application.Relatos;
using Ampara.Application.Rota;

namespace Ampara.Api.Workers;

/// <summary>Apaga da rota o que passou de 7 dias, os relatos que passaram de 2 horas e as tentativas de emergência com mais de 24 horas, a cada hora. Escopo novo por execução.</summary>
public sealed class RetencaoWorker(IServiceScopeFactory escopos, TimeProvider tempo, ILogger<RetencaoWorker> log) : BackgroundService
{
    public static readonly TimeSpan Intervalo = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(Intervalo, tempo);
        do
        {
            try
            {
                using var escopo = escopos.CreateScope();
                var apagados = await escopo.ServiceProvider.GetRequiredService<IRotaService>().PurgarExpiradosAsync(ct);
                if (apagados > 0) log.LogInformation("Retencao da rota: {Total} pontos apagados", apagados);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                // Só o tipo vai para o log: a mensagem pode carregar dado pessoal.
                log.LogError("Retencao da rota falhou: tipo={Tipo}", ex.GetType().Name);
            }

            // Escopo próprio: a falha de uma purga não impede a outra.
            try
            {
                using var escopo = escopos.CreateScope();
                var apagados = await escopo.ServiceProvider.GetRequiredService<IRelatoService>().PurgarExpiradosAsync(ct);
                if (apagados > 0) log.LogInformation("Retencao dos relatos: {Total} apagados", apagados);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                log.LogError("Retencao dos relatos falhou: tipo={Tipo}", ex.GetType().Name);
            }

            try
            {
                using var escopo = escopos.CreateScope();
                var apagadas = await escopo.ServiceProvider.GetRequiredService<IAuthService>().PurgarTentativasAsync(ct);
                if (apagadas > 0) log.LogInformation("Retencao das tentativas de emergencia: {Total} apagadas", apagadas);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                log.LogError("Retencao das tentativas de emergencia falhou: tipo={Tipo}", ex.GetType().Name);
            }
        }
        while (await SeguirAsync(timer, ct));
    }

    private static async Task<bool> SeguirAsync(PeriodicTimer t, CancellationToken ct)
    {
        try { return await t.WaitForNextTickAsync(ct); }
        catch (OperationCanceledException) { return false; }
    }
}
