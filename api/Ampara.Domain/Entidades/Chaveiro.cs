namespace Ampara.Domain.Entidades;

/// <summary>Chaveiro pareado a um usuário. O <see cref="DeviceId"/> é único no sistema.</summary>
public sealed class Chaveiro
{
    public const int LimiteBateriaBaixa = 15;

    public Guid Id { get; private set; }
    public string DeviceId { get; private set; } = "";
    public Guid UsuarioId { get; private set; }
    public bool Online { get; private set; }
    public int? Bateria { get; private set; }
    public bool BateriaBaixa { get; private set; }
    public DateTime? VistoEm { get; private set; }
    public DateTime PareadoEm { get; private set; }

    private Chaveiro() { }

    public static Chaveiro Parear(Guid usuarioId, string deviceId, DateTime agora) => new()
    {
        Id = Guid.NewGuid(),
        UsuarioId = usuarioId,
        DeviceId = deviceId,
        PareadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
    };

    /// <summary>Bateria nula preserva a anterior; BateriaBaixa vale quando bateria &lt;= 15.</summary>
    public void AtualizarStatus(bool online, int? bateria, DateTime em)
    {
        Online = online;
        if (bateria.HasValue) Bateria = bateria;
        BateriaBaixa = Bateria is <= LimiteBateriaBaixa;
        VistoEm = DateTime.SpecifyKind(em, DateTimeKind.Utc);
    }

    /// <summary>Qualquer mensagem do chaveiro (evento, ack) prova que está online.</summary>
    public void RegistrarSinal(int? bateria, DateTime em) => AtualizarStatus(true, bateria, em);
}
