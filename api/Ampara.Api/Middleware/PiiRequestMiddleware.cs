namespace Ampara.Api.Middleware;

public sealed class PiiRequestMiddleware(RequestDelegate next)
{
    // plano 03: inspeciona query/header/corpo com o ITaintGuard. No plano 02 só repassa.
    public Task InvokeAsync(HttpContext ctx) => next(ctx);
}
