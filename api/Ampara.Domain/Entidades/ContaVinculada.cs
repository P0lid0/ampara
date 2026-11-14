namespace Ampara.Domain.Entidades;

/// <summary>Conta que o usuário vinculou. O slug do catálogo só existe cifrado (revela quais bancos a pessoa usa).</summary>
public sealed class ContaVinculada
{
    public Guid Id { get; private set; }
    public Guid UsuarioId { get; private set; }
    public string CatalogoIdCifrado { get; private set; } = "";
    public DateTime CriadoEm { get; private set; }

    private ContaVinculada() { }

    public static ContaVinculada Criar(Guid usuarioId, string catalogoIdCifrado, DateTime agora) => new()
    {
        Id = Guid.NewGuid(),
        UsuarioId = usuarioId,
        CatalogoIdCifrado = catalogoIdCifrado,
        CriadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
    };
}
