namespace Ampara.Domain.Entidades;

/// <summary>Convite de guardião: código curto, válido por 24 h e de uso único.</summary>
public sealed class Convite
{
    public static readonly TimeSpan Validade = TimeSpan.FromHours(24);

    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public string Codigo { get; set; } = "";
    public DateTime ExpiraEm { get; set; }
    public DateTime? UsadoEm { get; set; }

    public static Convite Criar(Guid usuarioId, string codigo, DateTime agora)
    {
        var utc = DateTime.SpecifyKind(agora, DateTimeKind.Utc);
        return new Convite { Id = Guid.NewGuid(), UsuarioId = usuarioId, Codigo = codigo, ExpiraEm = utc + Validade };
    }

    public bool Valido(DateTime agora) => UsadoEm is null && ExpiraEm > agora;

    public void Usar(DateTime agora) => UsadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc);
}
