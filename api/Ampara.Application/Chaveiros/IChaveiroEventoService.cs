namespace Ampara.Application.Chaveiros;

/// <summary>Entrada dos eventos MQTT do chaveiro. Nunca lança por causa de mensagem ruim: descarta.</summary>
public interface IChaveiroEventoService
{
    Task TratarEventoAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct);
    Task TratarStatusAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct);
}
