using Ampara.Application.Auth;
using Ampara.Application.Comum;
using Ampara.Application.Rota;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Api.Endpoints;

public static class MeEndpoints
{
    public sealed record EmergenciaDefinicao(string? Codigo, string? PalavraSecreta);
    public sealed record ConsentimentoDefinicao(bool? Aceito);

    public static IEndpointRouteBuilder MapMe(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/me").WithTags("Me").RequireAuthorization("Usuario");

        g.MapGet("", async (HttpContext http, IAmparaDb db, CancellationToken ct) =>
        {
            var ator = http.User.ToAtor();
            var u = await db.Usuarios.AsNoTracking().SingleOrDefaultAsync(x => x.Id == ator.UsuarioId, ct)
                ?? throw new NaoAutenticadoException("token-invalido");
            return Results.Ok(new
            {
                usuarioId = u.Id,
                nome = u.Nome,
                email = u.Email,
                consentimentoRota = u.ConsentimentoRota,
                emergenciaConfigurada = u.TemEmergenciaConfigurada,
            });
        });

        g.MapPut("/emergencia", async (EmergenciaDefinicao e, HttpContext http, IAuthService auth, CancellationToken ct) =>
        {
            await auth.DefinirEmergenciaAsync(http.User.ToAtor().UsuarioId, e.Codigo ?? "", e.PalavraSecreta ?? "", ct);
            return Results.NoContent();
        });

        // Revogar também apaga os pontos da rota.
        g.MapPut("/consentimento-rota", async (ConsentimentoDefinicao c, HttpContext http, IAmparaDb db, IRotaService rota, TimeProvider tempo, CancellationToken ct) =>
        {
            if (c.Aceito is null) throw new DominioException("aceito-obrigatorio");
            var ator = http.User.ToAtor();
            var u = await db.Usuarios.SingleOrDefaultAsync(x => x.Id == ator.UsuarioId, ct)
                ?? throw new NaoAutenticadoException("token-invalido");
            // Apaga antes de gravar a revogação: se algo falhar, o consentimento segue de pé e o pedido pode ser repetido.
            if (!c.Aceito.Value) await rota.ApagarTudoAsync(ator.UsuarioId, ct);
            u.AtualizarConsentimentoRota(c.Aceito.Value, tempo.GetUtcNow().UtcDateTime);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        return rotas;
    }
}
