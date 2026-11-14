namespace Ampara.Domain.Entidades;

/// <summary>Uma tentativa de entrada pelo código de emergência (só o e-mail normalizado, nunca o código).</summary>
public sealed class TentativaEmergencia
{
    public Guid Id { get; private set; }
    public string EmailNormalizado { get; private set; } = "";
    public DateTime Em { get; private set; }
    public bool Sucesso { get; private set; }

    private TentativaEmergencia() { }

    public static TentativaEmergencia Criar(string emailNormalizado, DateTime agora, bool sucesso) => new()
    {
        Id = Guid.NewGuid(),
        EmailNormalizado = emailNormalizado,
        Em = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
        Sucesso = sucesso,
    };
}
