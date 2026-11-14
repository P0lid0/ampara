using Ampara.Application.Auth;

namespace Ampara.Api.Endpoints;

public static class AuthEndpoints
{
    public sealed record RegistrarEntrada(string? Nome, string? Email, string? Senha);
    public sealed record LoginEntrada(string? Email, string? Senha);

    public static IEndpointRouteBuilder MapAuth(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/auth").WithTags("Auth");

        // Campos extras no corpo (papel, role) são ignorados: o registro sempre grava "usuario".
        g.MapPost("/registrar", async (RegistrarEntrada e, IAuthService auth, CancellationToken ct) =>
        {
            var id = await auth.RegistrarAsync(e.Nome ?? "", e.Email ?? "", e.Senha ?? "", ct);
            return Results.Json(new { usuarioId = id }, statusCode: StatusCodes.Status201Created);
        }).AllowAnonymous();

        g.MapPost("/login", async (LoginEntrada e, IAuthService auth, CancellationToken ct) =>
            Results.Ok(await auth.LoginAsync(e.Email ?? "", e.Senha ?? "", ct))).AllowAnonymous();

        return rotas;
    }
}
