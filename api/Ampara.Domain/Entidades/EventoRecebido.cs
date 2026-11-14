namespace Ampara.Domain.Entidades;

/// <summary>Evento do chaveiro já tratado. O índice único em <see cref="EventId"/> garante a idempotência.</summary>
public sealed class EventoRecebido
{
    public Guid Id { get; set; }
    public string EventId { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string Tipo { get; set; } = "";
    public DateTime RecebidoEm { get; set; }
    public Guid? OcorrenciaId { get; set; }
}
