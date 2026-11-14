using System.Security.Claims;
using Ampara.Application.Comum;

namespace Ampara.Api.Endpoints;

public static class AtorExtensions
{
    /// <summary>Monta o Ator a partir das claims do JWT (sub e scope; MapInboundClaims = false).</summary>
    public static Ator ToAtor(this ClaimsPrincipal p)
    {
        var sub = p.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id)) throw new NaoAutenticadoException("token-invalido");
        return new Ator(id, p.FindFirstValue("scope") ?? Escopos.Usuario);
    }
}
