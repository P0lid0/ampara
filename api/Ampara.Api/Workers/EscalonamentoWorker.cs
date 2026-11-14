using Ampara.Application.Alertas;

namespace Ampara.Api.Workers;

/// <summary>Escala os alertas sem "ciente" a cada 5 s. Escopo novo por execução.</summary>
public sealed class EscalonamentoWorker(IServiceScopeFactory escopos, TimeProvider tempo, ILogger<EscalonamentoWorker> log) : BackgroundService
{
    public static readonly TimeSpan Intervalo = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(Intervalo, tempo);
        do
        {
            try
            {
                using var escopo = escopos.CreateScope();
                var escaladas = await escopo.ServiceProvider.GetRequiredService<IEscalonamento>().ProcessarVencidosAsync(ct);
                if (escaladas > 0) log.LogInformation("Escalada: {Total} ocorrencias escaladas", escaladas);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                // Só o tipo vai para o log: a mensagem pode carregar dado pessoal.
                log.LogError("Escalada falhou: tipo={Tipo}", ex.GetType().Name);
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
