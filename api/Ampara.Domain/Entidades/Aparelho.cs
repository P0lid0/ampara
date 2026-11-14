namespace Ampara.Domain.Entidades;

/// <summary>Aparelho do usuário. O IMEI só existe cifrado; <see cref="ImeiFinal"/> (4 dígitos) serve para exibir mascarado.</summary>
public sealed class Aparelho
{
    public Guid Id { get; private set; }
    public Guid UsuarioId { get; private set; }
    public string ImeiCifrado { get; private set; } = "";
    public string ImeiFinal { get; private set; } = "";
    public string Marca { get; private set; } = "";
    public string Modelo { get; private set; } = "";
    public DateTime CriadoEm { get; private set; }

    private Aparelho() { }

    public static Aparelho Criar(Guid usuarioId, string imeiCifrado, string imeiFinal, string marca, string modelo, DateTime agora) => new()
    {
        Id = Guid.NewGuid(),
        UsuarioId = usuarioId,
        ImeiCifrado = imeiCifrado,
        ImeiFinal = imeiFinal,
        Marca = marca,
        Modelo = modelo,
        CriadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
    };
}
