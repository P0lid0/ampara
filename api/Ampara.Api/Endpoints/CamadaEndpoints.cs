using Ampara.Application.Comum;
using Ampara.Infrastructure.Dados;

namespace Ampara.Api.Endpoints;

public static class CamadaEndpoints
{
    public static IEndpointRouteBuilder MapCamadas(this IEndpointRouteBuilder rotas)
    {
        // Pública: só pontos de interesse (nome, lat, lng), nada de dado pessoal.
        rotas.MapGet("/api/v1/camadas/{tipo}", (string tipo, CamadasMapa camadas) =>
        {
            var itens = camadas.Obter(tipo.Trim().ToLowerInvariant()) ?? throw new NaoEncontradoException("camada-desconhecida");
            return Results.Ok(itens.Select(p => new { nome = p.Nome, lat = p.Lat, lng = p.Lng }));
        }).WithTags("Camadas").AllowAnonymous();
        return rotas;
    }
}
