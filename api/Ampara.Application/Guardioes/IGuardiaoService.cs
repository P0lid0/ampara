namespace Ampara.Application.Guardioes;

public sealed record ConviteDto(string Codigo, DateTime ExpiraEm);
public sealed record GuardiaoDto(Guid GuardiaoId, string Nome, int Ordem);

public interface IGuardiaoService
{
    Task<ConviteDto> CriarConviteAsync(Guid usuarioId, CancellationToken ct);
    Task AceitarConviteAsync(Guid guardiaoUsuarioId, string codigo, CancellationToken ct);
    Task<IReadOnlyList<GuardiaoDto>> ListarAsync(Guid usuarioId, CancellationToken ct);
    Task DefinirOrdemAsync(Guid usuarioId, IReadOnlyList<Guid> ordem, CancellationToken ct);
    Task<bool> EhGuardiaoDeAsync(Guid guardiaoUsuarioId, Guid vitimaId, CancellationToken ct);
}
