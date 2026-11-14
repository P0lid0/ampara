using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Drena a fila e persiste cada evento num scope proprio. Falha de banco so vai para o log, sem valor de dado.</summary>
public sealed class RastroSegurancaWorker(RastroSeguranca rastro, IServiceScopeFactory escopos, ILogger<RastroSegurancaWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try
        {
            await foreach (var e in rastro.Leitor.ReadAllAsync(ct)) await ProcessarAsync(e, ct);
        }
        catch (OperationCanceledException) { }
    }

    public async Task ProcessarAsync(EventoSeguranca e, CancellationToken ct)
    {
        try
        {
            await using var escopo = escopos.CreateAsyncScope();
            // O tradutor nunca lanca e tem teto de 5 s; sem ele registrado, o evento segue sem mensagem.
            var tradutor = escopo.ServiceProvider.GetService<ITradutorRisco>();
            if (tradutor is not null) e.MensagemCidadao = await tradutor.TraduzirAsync(EventoTecnico.De(e), ct);
            await escopo.ServiceProvider.GetRequiredService<IEventoSegurancaRepository>().AdicionarAsync(e, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            // So id, classe e sink: nunca o valor, a mensagem da excecao pode carregar parametros do SQL.
            log.LogWarning("Falha ao gravar evento de seguranca {EventoId} (classe {Classe}, sink {Sink}): {Tipo}", e.Id, e.Classe, e.Sink, ex.GetType().Name);
        }
    }
}
