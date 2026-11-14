using System.Text.Json.Serialization;

namespace Ampara.Application.Chaveiros;

/// <summary>Comando para o chaveiro. Serializa {"cmd":"ack","eventId":"..."} omitindo os nulos.</summary>
public sealed record ComandoChaveiro(
    [property: JsonPropertyName("cmd")] string Cmd,
    [property: JsonPropertyName("eventId"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? EventId = null,
    [property: JsonPropertyName("alertId"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? AlertId = null)
{
    public static ComandoChaveiro Ack(string eventId) => new("ack", EventId: eventId);
    public static ComandoChaveiro Resolve(string alertId) => new("resolve", AlertId: alertId);
    public static ComandoChaveiro Find() => new("find");
    public static ComandoChaveiro Ping() => new("ping");
}
