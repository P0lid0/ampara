namespace Ampara.Api.Middleware;

public sealed class CorrelacaoMiddleware(RequestDelegate next)
{
    public const string Cabecalho = "X-Correlation-Id";
    public const string ItemKey = "CorrelationId";

    public Task InvokeAsync(HttpContext ctx)
    {
        var recebido = ctx.Request.Headers[Cabecalho].ToString();
        var id = string.IsNullOrWhiteSpace(recebido) || recebido.Length > 100 ? Guid.NewGuid().ToString() : recebido;
        ctx.Items[ItemKey] = id;
        ctx.Response.OnStarting(() => { ctx.Response.Headers[Cabecalho] = id; return Task.CompletedTask; });
        return next(ctx);
    }
}
