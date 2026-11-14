using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Api.Endpoints;
using Microsoft.AspNetCore.Mvc;

namespace Ampara.Api.Cyber;

public sealed record SimularAtaqueRequest(string? Cenario);

public static class SegurancaEndpoints
{
    public static IEndpointRouteBuilder MapSeguranca(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/seguranca").WithTags("Seguranca");

        g.MapGet("/meu-risco", async (HttpContext http, IIndiceRiscoService servico, CancellationToken ct) =>
            Results.Ok(await servico.MeuRiscoAsync(http.User.ToAtor().UsuarioId, ct))).RequireAuthorization("Usuario");

        g.MapGet("/executivo", async (IIndiceRiscoService servico, CancellationToken ct) =>
            Results.Ok(await servico.ExecutivoAsync(ct))).RequireAuthorization("Admin");

        // Só em demonstração: fora dela a rota nem existe (404), para o simulador não virar vetor em produção.
        g.MapPost("/simular-ataque", (SimularAtaqueRequest? req, HttpContext http, IConfiguration cfg, SimuladorDeAtaque simulador, ICorrelacao correlacao) =>
        {
            if (!cfg.GetValue<bool>("AMPARA_DEMO")) return Results.NotFound();
            if (!SimuladorDeAtaque.Conhece(req?.Cenario)) throw new DominioException("cenario-desconhecido");
            Guid? alvo = Guid.TryParse(http.User.FindFirst("sub")?.Value, out var id) ? id : null;
            simulador.Executar(req!.Cenario!, alvo, correlacao.Id);
            return Results.Accepted();
        }).AllowAnonymous();
        return rotas;
    }
}
