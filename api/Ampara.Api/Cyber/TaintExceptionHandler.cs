using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Diagnostics;

namespace Ampara.Api.Cyber;

/// <summary>
/// Sink <see cref="Sink.Erro"/>: assume só as exceções inesperadas (as de <see cref="AmparaException"/> ficam com o
/// ProblemaHandler). Responde 500 com uma frase humana; nunca devolve Message, stack ou nome de tipo. O texto completo
/// da exceção passa pelo guard: cada classe de dado achada vira evento Erro/Bloqueado.
/// </summary>
public sealed class TaintExceptionHandler(ILogger<TaintExceptionHandler> log) : IExceptionHandler
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        if (ex is AmparaException) return false;
        if (ex is OperationCanceledException && ctx.RequestAborted.IsCancellationRequested) return true;   // cliente foi embora: sem corpo
        if (ctx.Response.HasStarted) return false;

        var sp = ctx.RequestServices;
        var cid = ctx.Items[Middleware.CorrelacaoMiddleware.ItemKey] as string ?? sp.GetService<ICorrelacao>()?.Id ?? "";

        // Fail-closed: qualquer falha ao varrer ou traduzir cai na frase padrão, sem eco da exceção.
        string? classe = null;
        try
        {
            var guard = sp.GetRequiredService<ITaintGuard>();
            var r = guard.Sanitizar(ex.ToString(), Sink.Erro, new SanitizarOpcoes(OrigemDado.Http, "excecao", null, cid));
            classe = r.Eventos.FirstOrDefault(e => e.Decisao == Decisao.Bloqueado)?.Classe.ToString();
        }
        catch (Exception falha)
        {
            log.LogWarning("Falha ao varrer a exceção: {Tipo}", falha.GetType().Name);
        }

        var frase = FrasesPadrao.FalhaSistema;
        try
        {
            var tradutor = sp.GetRequiredService<ITradutorRisco>();
            var tecnico = classe is null
                ? new EventoTecnico("FalhaSistema", nameof(Sink.Erro), ex.GetType().Name)
                : new EventoTecnico(classe, nameof(Sink.Erro), nameof(Decisao.Bloqueado));
            frase = await tradutor.TraduzirAsync(tecnico, ctx.RequestAborted);
        }
        catch (Exception falha)
        {
            log.LogWarning("Tradutor de risco falhou no handler de erro: {Tipo}", falha.GetType().Name);
        }

        // O logger já é protegido (sink Log): a exceção completa vai para lá, mascarada.
        log.LogError(ex, "Erro inesperado correlationId={CorrelationId}", cid);

        ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
        ctx.Response.ContentType = "application/problem+json";
        var corpo = new
        {
            type = "urn:ampara:erro", title = "Não foi possível concluir a ação",
            status = StatusCodes.Status500InternalServerError, correlationId = cid, detalheCidadao = frase,
        };
        await JsonSerializer.SerializeAsync(ctx.Response.Body, corpo, Json, ctx.RequestAborted);
        return true;
    }
}
