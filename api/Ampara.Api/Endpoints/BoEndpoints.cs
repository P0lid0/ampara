using Ampara.Api.Middleware;
using Ampara.Application.Bo;

namespace Ampara.Api.Endpoints;

public static class BoEndpoints
{
    public static IEndpointRouteBuilder MapBo(this IEndpointRouteBuilder rotas)
    {
        rotas.MapGet("/api/v1/ocorrencias/{id:guid}/bo", async (Guid id, HttpContext http, IBoGenerator bo, CancellationToken ct) =>
            Results.Ok(await bo.GerarAsync(http.User.ToAtor(), id, ct, http.Items[CorrelacaoMiddleware.ItemKey] as string)))
            .WithTags("BO").RequireAuthorization("UsuarioOuEmergencia");
        return rotas;
    }
}
