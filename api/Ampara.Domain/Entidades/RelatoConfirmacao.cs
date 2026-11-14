namespace Ampara.Domain.Entidades;

/// <summary>Confirmacao de um relato por um usuario. Unica por (RelatoId, UsuarioId); o autor conta como a primeira.</summary>
public sealed class RelatoConfirmacao
{
    public Guid Id { get; private set; }
    public Guid RelatoId { get; private set; }
    public Guid UsuarioId { get; private set; }
    public DateTime Em { get; private set; }

    private RelatoConfirmacao() { }

    public static RelatoConfirmacao Criar(Guid relatoId, Guid usuarioId, DateTime em) => new()
    {
        Id = Guid.NewGuid(),
        RelatoId = relatoId,
        UsuarioId = usuarioId,
        Em = DateTime.SpecifyKind(em, DateTimeKind.Utc),
    };
}
