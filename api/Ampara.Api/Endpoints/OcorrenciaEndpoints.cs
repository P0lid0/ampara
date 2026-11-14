using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Application.Guardioes;
using Ampara.Application.Ocorrencias;
using Ampara.Domain;
using Ampara.Domain.Gatilhos;

namespace Ampara.Api.Endpoints;

public static class OcorrenciaEndpoints
{
    public sealed record GatilhoNovo(string? Origem, Guid? VitimaId);
    public sealed record MomentoNovo(DateTime? Em, double? Lat, double? Lng);

    public static IEndpointRouteBuilder MapOcorrencias(this IEndpointRouteBuilder rotas)
    {
        var g = rotas.MapGroup("/api/v1/ocorrencias").WithTags("Ocorrencias").RequireAuthorization("UsuarioOuEmergencia");

        g.MapPost("/gatilho", async (GatilhoNovo n, HttpContext http, IOcorrenciaService svc, IGuardiaoService guardioes, IAcessoIndevido acesso, CancellationToken ct) =>
        {
            var ator = http.User.ToAtor();
            var origem = (n.Origem ?? "").Trim().ToLowerInvariant();
            IGatilho gatilho;
            Guid vitima;
            if (ator.Escopo == Escopos.Emergencia && origem == "web")
            {
                if (n.VitimaId is { } v && v != ator.UsuarioId)
                {
                    acesso.Registrar(v, "recurso-de-outro-usuario");
                    throw new AcessoNegadoException("vitima-de-outro-usuario");
                }
                vitima = ator.UsuarioId;
                gatilho = new GatilhoWeb();
            }
            else if (ator.Escopo == Escopos.Usuario && origem == "guardiao")
            {
                vitima = n.VitimaId ?? throw new DominioException("origem-invalida");
                if (!await guardioes.EhGuardiaoDeAsync(ator.UsuarioId, vitima, ct))
                {
                    acesso.Registrar(vitima, "recurso-de-outro-usuario");
                    throw new AcessoNegadoException("nao-e-guardiao");
                }
                gatilho = new GatilhoGuardiao(ator.UsuarioId);
            }
            else throw new DominioException("origem-invalida");

            var r = await svc.DispararAsync(gatilho, vitima, ct);
            var corpo = new { ocorrenciaId = r.OcorrenciaId };
            return r.Nova ? Results.Created($"/api/v1/ocorrencias/{r.OcorrenciaId}", corpo) : Results.Ok(corpo);
        });

        g.MapGet("", async (HttpContext http, IOcorrenciaService svc, CancellationToken ct) =>
            Results.Ok(await svc.ListarAsync(http.User.ToAtor(), ct)));

        g.MapGet("{id:guid}", async (Guid id, HttpContext http, IOcorrenciaService svc, CancellationToken ct) =>
            Results.Ok(await svc.ObterAsync(http.User.ToAtor(), id, ct)));

        g.MapPost("{id:guid}/momento", async (Guid id, MomentoNovo n, HttpContext http, IOcorrenciaService svc, CancellationToken ct) =>
        {
            if (n is not { Em: { } em, Lat: { } lat, Lng: { } lng }) throw new DominioException("momento-invalido");
            await svc.MarcarMomentoAsync(http.User.ToAtor(), id, em, lat, lng, ct);
            return Results.NoContent();
        });

        g.MapPost("{id:guid}/cancelar", async (Guid id, HttpContext http, IOcorrenciaService svc, CancellationToken ct) =>
        {
            await svc.CancelarAsync(http.User.ToAtor(), id, ct);
            return Results.NoContent();
        });

        g.MapPost("{id:guid}/passos/{passo}/concluir", async (Guid id, string passo, HttpContext http, IOcorrenciaService svc, CancellationToken ct) =>
        {
            // Só os nomes do enum (sem diferenciar maiúsculas): "1" ou "Banco,Bo" não passam.
            var nome = Enum.GetNames<PassoBloqueio>().FirstOrDefault(n => string.Equals(n, passo, StringComparison.OrdinalIgnoreCase))
                ?? throw new DominioException("passo-invalido");
            await svc.ConcluirPassoAsync(http.User.ToAtor(), id, Enum.Parse<PassoBloqueio>(nome), ct);
            return Results.NoContent();
        });

        return rotas;
    }
}
