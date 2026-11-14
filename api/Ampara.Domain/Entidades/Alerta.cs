namespace Ampara.Domain.Entidades;

/// <summary>Aviso a um guardião sobre uma ocorrência. Nasce Ativo; vira Ciente (o guardião confirmou) ou Encerrado.</summary>
public sealed class Alerta
{
    public Guid Id { get; private set; }
    public Guid OcorrenciaId { get; private set; }
    public Guid GuardiaoId { get; private set; }          // Guardiao.Id
    public Guid GuardiaoUsuarioId { get; private set; }   // quem recebe
    public EstadoAlerta Estado { get; private set; }
    public DateTime DisparadoEm { get; private set; }
    public DateTime? CienteEm { get; private set; }
    public DateTime? EscaladoEm { get; private set; }

    private Alerta() { }

    public static Alerta Disparar(Guid ocorrenciaId, Guardiao g, DateTime agora) => new()
    {
        Id = Guid.NewGuid(),
        OcorrenciaId = ocorrenciaId,
        GuardiaoId = g.Id,
        GuardiaoUsuarioId = g.GuardiaoUsuarioId,
        Estado = EstadoAlerta.Ativo,
        DisparadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
    };

    /// <summary>Idempotente: repetir não muda o horário. Alerta já encerrado não volta a Ciente.</summary>
    public void Confirmar(DateTime agora)
    {
        if (Estado != EstadoAlerta.Ativo) return;
        Estado = EstadoAlerta.Ciente;
        CienteEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc);
    }

    /// <summary>Marca que a escalada para o próximo guardião já partiu deste alerta.</summary>
    public void MarcarEscalado(DateTime agora) => EscaladoEm ??= DateTime.SpecifyKind(agora, DateTimeKind.Utc);

    public void Encerrar() => Estado = EstadoAlerta.Encerrado;
}
