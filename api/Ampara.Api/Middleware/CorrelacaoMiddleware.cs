using System.Text.RegularExpressions;

namespace Ampara.Api.Middleware;

public sealed partial class CorrelacaoMiddleware(RequestDelegate next)
{
    public const string Cabecalho = "X-Correlation-Id";
    public const string ItemKey = "CorrelationId";

    // Mesmo formato do ICorrelacao do plano 03. O id vai para o log, para o problem+json e para o rastro de
    // segurança: fora do formato (espaço, ponto, @, quebra de linha) vira um GUID novo.
    [GeneratedRegex("^[A-Za-z0-9-]{1,64}$")]
    private static partial Regex Formato();

    public Task InvokeAsync(HttpContext ctx)
    {
        var recebido = ctx.Request.Headers[Cabecalho].ToString();
        var id = Formato().IsMatch(recebido) ? recebido : Guid.NewGuid().ToString();
        ctx.Items[ItemKey] = id;
        ctx.Response.OnStarting(() => { ctx.Response.Headers[Cabecalho] = id; return Task.CompletedTask; });
        return next(ctx);
    }
}
