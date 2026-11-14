using Ampara.Application.Guardioes;

namespace Ampara.Api.Endpoints;

public static class GuardiaoEndpoints
{
    public sealed record OrdemNova(List<Guid>? Ordem);

    public static IEndpointRouteBuilder MapGuardioes(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/guardioes").WithTags("Guardioes").RequireAuthorization("Usuario");

        g.MapPost("convites", async (HttpContext http, IGuardiaoService svc, CancellationToken ct) =>
        {
            var c = await svc.CriarConviteAsync(http.User.ToAtor().UsuarioId, ct);
            return Results.Ok(new { codigo = c.Codigo, expiraEm = c.ExpiraEm });
        });

        g.MapPost("convites/{codigo}/aceitar", async (string codigo, HttpContext http, IGuardiaoService svc, CancellationToken ct) =>
        {
            await svc.AceitarConviteAsync(http.User.ToAtor().UsuarioId, codigo, ct);
            return Results.NoContent();
        });

        g.MapGet("", async (HttpContext http, IGuardiaoService svc, CancellationToken ct) =>
            Results.Ok((await svc.ListarAsync(http.User.ToAtor().UsuarioId, ct))
                .Select(x => new { guardiaoId = x.GuardiaoId, nome = x.Nome, ordem = x.Ordem })));

        g.MapPut("ordem", async (OrdemNova corpo, HttpContext http, IGuardiaoService svc, CancellationToken ct) =>
        {
            await svc.DefinirOrdemAsync(http.User.ToAtor().UsuarioId, corpo.Ordem ?? [], ct);
            return Results.NoContent();
        });

        return rotas;
    }
}
