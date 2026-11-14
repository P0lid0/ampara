using Ampara.Domain;
using Ampara.Domain.Entidades;

namespace Ampara.Application.Ocorrencias;

public sealed record OcorrenciaCriada(Guid OcorrenciaId, bool Nova);

public sealed record MomentoDto(DateTime Em, double Lat, double Lng);
public sealed record PassoDto(string Passo, DateTime? ConcluidoEm);
public sealed record AlertaDto(Guid AlertaId, Guid GuardiaoId, DateTime EnviadoEm, DateTime? CienteEm);
public sealed record ContaOcorrenciaDto(string Nome, string Tipo, string? Telefone, string Link);

/// <summary>Formato do contrato (JSON camelCase). Estado como o enum ("Aberta"...), origem em minúsculas.</summary>
public sealed record OcorrenciaDto(
    Guid Id,
    string Estado,
    string Origem,
    DateTime IniciadaEm,
    MomentoDto? Momento,
    IReadOnlyList<PassoDto> Passos,
    IReadOnlyList<AlertaDto> Alertas,
    IReadOnlyList<ContaOcorrenciaDto> Contas);

public static class OcorrenciaMapa
{
    public static string OrigemTexto(OrigemGatilho o) => o.ToString().ToLowerInvariant();

    public static OcorrenciaDto ParaDto(Ocorrencia o, bool comMomento, IReadOnlyList<AlertaDto> alertas, IReadOnlyList<ContaOcorrenciaDto> contas) => new(
        o.Id,
        o.Estado.ToString(),
        OrigemTexto(o.Origem),
        o.IniciadaEm,
        comMomento && o is { MomentoEm: { } em, MomentoLat: { } lat, MomentoLng: { } lng } ? new MomentoDto(em, lat, lng) : null,
        o.Passos.OrderBy(p => p.Passo).Select(p => new PassoDto(p.Passo.ToString(), p.ConcluidoEm)).ToList(),
        alertas,
        contas);
}
