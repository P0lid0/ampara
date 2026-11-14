namespace Ampara.Application.Chaveiros;

public sealed record ChaveiroDto(string DeviceId, bool Online, int? Bateria, DateTime? VistoEm);

public interface IChaveiroService
{
    Task<Guid> ParearAsync(Guid usuarioId, string deviceId, CancellationToken ct);
    Task<IReadOnlyList<ChaveiroDto>> ListarAsync(Guid usuarioId, CancellationToken ct);

    /// <summary>find | ping (resolve entra na T11).</summary>
    Task EnviarComandoAsync(Guid usuarioId, string deviceId, string cmd, CancellationToken ct);
}
