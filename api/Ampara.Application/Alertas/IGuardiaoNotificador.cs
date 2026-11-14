namespace Ampara.Application.Alertas;

/// <summary>Tempo real para o app do guardião. Todos os Guid de destino são usuarioId de guardião.</summary>
public interface IGuardiaoNotificador
{
    Task AlertaDisparadoAsync(Guid guardiaoUsuarioId, AlertaDisparadoMsg m, CancellationToken ct);
    Task AlertaEscaladoAsync(IEnumerable<Guid> guardioesUsuarioIds, AlertaEscaladoMsg m, CancellationToken ct);
    Task AlertaEncerradoAsync(Guid guardiaoUsuarioId, AlertaEncerradoMsg m, CancellationToken ct);
    Task PassoAtualizadoAsync(IEnumerable<Guid> guardioesUsuarioIds, PassoAtualizadoMsg m, CancellationToken ct);
}
