namespace Ampara.Domain.Entidades;

/// <summary>Ponto da rota dos últimos 7 dias. Único por (UsuarioId, Em): retransmissão da fila offline não duplica.</summary>
public sealed class PontoRota
{
    public Guid Id { get; private set; }
    public Guid UsuarioId { get; private set; }
    public double Lat { get; private set; }
    public double Lng { get; private set; }
    public double? Precisao { get; private set; }
    public DateTime Em { get; private set; }

    private PontoRota() { }

    public static PontoRota Criar(Guid usuarioId, double lat, double lng, double? precisao, DateTime em) => new()
    {
        Id = Guid.NewGuid(),
        UsuarioId = usuarioId,
        Lat = lat,
        Lng = lng,
        Precisao = precisao,
        Em = DateTime.SpecifyKind(em, DateTimeKind.Utc),
    };
}
