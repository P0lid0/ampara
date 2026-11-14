namespace Ampara.Domain.Entidades;

public static class Papeis
{
    public const string Usuario = "usuario";
    public const string Admin = "admin";
}

public sealed class Usuario
{
    public Guid Id { get; private set; }
    public string Nome { get; private set; } = "";
    public string Email { get; private set; } = "";
    public string SenhaHash { get; private set; } = "";
    public string Papel { get; private set; } = Papeis.Usuario;   // "usuario" | "admin"
    public string? CodigoEmergenciaHash { get; private set; }
    public string? PalavraSecretaHash { get; private set; }
    public bool ConsentimentoRota { get; private set; }
    public DateTime? ConsentimentoEm { get; private set; }
    public DateTime CriadoEm { get; private set; }

    private Usuario() { }

    /// <summary>Cria sempre com papel "usuario". O admin só nasce no DemoSeeder (T21), via <see cref="PromoverAAdmin"/>.</summary>
    public static Usuario Criar(string nome, string emailNormalizado, string senhaHash, DateTime agora) => new()
    {
        Id = Guid.NewGuid(),
        Nome = nome,
        Email = emailNormalizado,
        SenhaHash = senhaHash,
        Papel = Papeis.Usuario,
        CriadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
    };

    public void PromoverAAdmin() => Papel = Papeis.Admin;

    public void DefinirEmergencia(string codigoHash, string palavraHash)
    {
        CodigoEmergenciaHash = codigoHash;
        PalavraSecretaHash = palavraHash;
    }

    public void AtualizarConsentimentoRota(bool aceito, DateTime agora)
    {
        ConsentimentoRota = aceito;
        ConsentimentoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc);
    }

    public bool TemEmergenciaConfigurada => !string.IsNullOrEmpty(CodigoEmergenciaHash) && !string.IsNullOrEmpty(PalavraSecretaHash);
}
