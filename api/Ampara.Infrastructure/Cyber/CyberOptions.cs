namespace Ampara.Infrastructure.Cyber;

/// <summary>Opções da seção <c>Cyber</c>. <c>Demo</c> vem de <c>AMPARA_DEMO</c>; <c>TaintAtivo=false</c> só vale em demonstração.</summary>
public sealed class CyberOptions
{
    public const string Secao = "Cyber";

    public bool TaintAtivo { get; set; } = true;
    public bool Demo { get; set; }
    public int LimiteCorpoBytes { get; set; } = 1_048_576;
    public int MaxProfundidadeJson { get; set; } = 64;

    /// <summary>Rota (caminho exato) para nomes de campo tratados como <c>Senha</c>.</summary>
    public Dictionary<string, string[]> ChavesPorRota { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        ["/api/v1/auth/emergencia"] = ["codigo"],
        ["/api/v1/me/emergencia"] = ["codigo"],
    };

    /// <summary>Falso só quando a demonstração desligou o taint de propósito.</summary>
    public bool Efetivo => !(Demo && !TaintAtivo);
}
