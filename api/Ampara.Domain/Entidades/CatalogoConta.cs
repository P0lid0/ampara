namespace Ampara.Domain.Entidades;

/// <summary>Instituição do catálogo curado (banco ou operadora). Id é um slug estável (ex.: "nubank").</summary>
public sealed class CatalogoConta
{
    public string Id { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Tipo { get; set; } = "";   // "banco" | "operadora"
    public string? Telefone { get; set; }
    public string Link { get; set; } = "";
    public string? ConferidoEm { get; set; } // YYYY-MM-DD, só quando telefone/link foram conferidos no site oficial
}
