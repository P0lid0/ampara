using Ampara.Application.Contas;

namespace Ampara.Api.Endpoints;

public static class ContaEndpoints
{
    public sealed record ContaNova(string? CatalogoId);

    public static IEndpointRouteBuilder MapContas(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/contas").WithTags("Contas");

        g.MapGet("catalogo", async (IContaService svc, CancellationToken ct) =>
            Results.Ok((await svc.ListarCatalogoAsync(ct))
                .Select(c => new { id = c.Id, nome = c.Nome, tipo = c.Tipo, telefone = c.Telefone, link = c.Link, conferidoEm = c.ConferidoEm })))
            .AllowAnonymous();

        g.MapPost("", async (ContaNova n, HttpContext http, IContaService svc, CancellationToken ct) =>
        {
            var id = await svc.VincularAsync(http.User.ToAtor().UsuarioId, n.CatalogoId ?? "", ct);
            return Results.Created($"/api/v1/contas/{id}", new { contaId = id });
        }).RequireAuthorization("Usuario");

        g.MapGet("", async (HttpContext http, IContaService svc, CancellationToken ct) =>
            Results.Ok((await svc.ListarVinculadasAsync(http.User.ToAtor().UsuarioId, ct))
                .Select(c => new { id = c.Id, nome = c.Nome, tipo = c.Tipo, telefone = c.Telefone, link = c.Link })))
            .RequireAuthorization("Usuario");

        return rotas;
    }
}
