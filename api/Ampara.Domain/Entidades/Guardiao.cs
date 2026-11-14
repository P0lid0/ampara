namespace Ampara.Domain.Entidades;

/// <summary>Pessoa de confiança de uma vítima. <see cref="Ordem"/> (1..3) define quem é acionado primeiro na escalada.</summary>
public sealed class Guardiao
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }          // a vítima
    public Guid GuardiaoUsuarioId { get; set; }  // quem protege
    public int Ordem { get; set; }
    public DateTime CriadoEm { get; set; }

    public bool PodeEscalar(IReadOnlyCollection<Guid> guardioesJaAcionados) => !guardioesJaAcionados.Contains(Id);
}
