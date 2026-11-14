using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>Evento como o cidadão o vê: sem o titular (<c>usuarioAlvoId</c>) e, claro, sem o valor do dado.</summary>
public sealed record EventoSegurancaDto(Guid Id, DateTimeOffset Em, string CorrelationId, OrigemDado Source, string Campo,
    PiiClasse Classe, Sink Sink, Decisao Decisao, string? MensagemCidadao);

public sealed record MeuRiscoDto(int Indice, Farol Farol, IReadOnlyList<EventoSegurancaDto> Eventos);

/// <summary><c>PorHora</c> tem 24 posições: 0 = há 23 h ... 23 = hora atual. Chaves de <c>PorClasse</c>/<c>PorSink</c> são os nomes do enum.</summary>
public sealed record ExecutivoDto(IReadOnlyDictionary<string, int> PorClasse, IReadOnlyDictionary<string, int> PorSink,
    IReadOnlyList<int> PorHora, int Total24h);

public interface IIndiceRiscoService
{
    Task<MeuRiscoDto> MeuRiscoAsync(Guid usuarioId, CancellationToken ct = default);

    Task<ExecutivoDto> ExecutivoAsync(CancellationToken ct = default);
}
