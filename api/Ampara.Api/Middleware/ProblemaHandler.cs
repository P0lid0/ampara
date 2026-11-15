using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Diagnostics;

namespace Ampara.Api.Middleware;

public sealed class ProblemaHandler(ILogger<ProblemaHandler> log) : IExceptionHandler
{
    private static readonly JsonSerializerOptions Opcoes = new(JsonSerializerDefaults.Web);

    // title é fixo por classe de exceção: nunca a mensagem.
    private static (int Status, string Title, string Codigo) Mapear(Exception ex) => ex switch
    {
        DominioException e => (422, "Regra de negócio violada", e.Codigo),
        NaoEncontradoException e => (404, "Não encontrado", e.Codigo),
        AcessoNegadoException e => (403, "Acesso negado", e.Codigo),
        ConflitoException e => (409, "Conflito", e.Codigo),
        RecursoVencidoException e => (410, "Recurso vencido", e.Codigo),
        NaoAutenticadoException e => (401, "Não autenticado", e.Codigo),
        ServicoIndisponivelException e => (502, "Serviço indisponível", e.Codigo),
        LimiteExcedidoException e => (429, "Limite excedido", e.Codigo),
        _ => (500, "Erro interno", "erro-interno"),
    };

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var (status, title, codigo) = Mapear(ex);
        var cid = ctx.Items[CorrelacaoMiddleware.ItemKey] as string ?? "";

        // Só o tipo e o correlationId vão para o log; Message pode carregar dado pessoal.
        log.LogWarning("Falha tratada: tipo={Tipo} status={Status} correlationId={CorrelationId}", ex.GetType().Name, status, cid);

        // Frase humana para o cidadão; o tradutor nunca lança, mas a resposta não pode depender disso.
        // 4xx é recusa de regra (senha errada, convite inválido, relato barrado): frase própria pelo código, nunca
        // "falha do nosso lado, tente em alguns minutos". Só o 5xx (serviço fora) é falha do sistema.
        var evento = status < 500 ? EventoTecnico.Recusa(codigo) : new EventoTecnico("FalhaSistema", "Erro", ex.GetType().Name);
        string? detalhe;
        try
        {
            var tradutor = ctx.RequestServices?.GetService<ITradutorRisco>();
            detalhe = tradutor is null ? null : await tradutor.TraduzirAsync(evento, ct);
        }
        catch (Exception) { detalhe = FrasesPadrao.Para(evento); }

        ctx.Response.StatusCode = status;
        if (ex is LimiteExcedidoException l)
            ctx.Response.Headers["Retry-After"] = ((int)Math.Ceiling(l.RetryAfter.TotalSeconds)).ToString();
        ctx.Response.ContentType = "application/problem+json";
        var corpo = new { type = "urn:ampara:erro:" + codigo, title, status, codigo, detalheCidadao = detalhe, correlationId = cid };
        await JsonSerializer.SerializeAsync(ctx.Response.Body, corpo, Opcoes, ct);
        return true;
    }
}
