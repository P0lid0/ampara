namespace Ampara.Domain.Entidades;

/// <summary>Relato colaborativo (roubo, furto, suspeita). Nunca guarda autor na resposta nem texto livre sem moderacao. Vive 2 horas.</summary>
public sealed class Relato
{
    public Guid Id { get; private set; }
    public Guid AutorId { get; private set; }
    public TipoRelato Tipo { get; private set; }
    public double Lat { get; private set; }
    public double Lng { get; private set; }
    public string AreaId { get; private set; } = "";
    public DateTime Em { get; private set; }
    public DateTime CriadoEm { get; private set; }
    [Ampara.Domain.Cyber.TextoLivre] public string? Texto { get; private set; }

    private Relato() { }

    public static Relato Criar(Guid autorId, TipoRelato tipo, double lat, double lng, string areaId, DateTime em, DateTime criadoEm, string? texto) => new()
    {
        Id = Guid.NewGuid(),
        AutorId = autorId,
        Tipo = tipo,
        Lat = lat,
        Lng = lng,
        AreaId = areaId,
        Em = DateTime.SpecifyKind(em, DateTimeKind.Utc),
        CriadoEm = DateTime.SpecifyKind(criadoEm, DateTimeKind.Utc),
        Texto = texto,
    };
}
