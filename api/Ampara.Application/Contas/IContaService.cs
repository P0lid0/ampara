using Ampara.Domain.Entidades;

namespace Ampara.Application.Contas;

public sealed record ContaVinculadaDto(Guid Id, string Nome, string Tipo, string? Telefone, string Link);

public interface IContaService
{
    Task<IReadOnlyList<CatalogoConta>> ListarCatalogoAsync(CancellationToken ct);

    /// <summary>Vincula uma conta do catálogo. Inexistente: NaoEncontrado (404); já vinculada: Conflito conta-ja-vinculada (409).</summary>
    Task<Guid> VincularAsync(Guid usuarioId, string catalogoId, CancellationToken ct);

    /// <summary>Contas do dono, com nome/telefone/link do catálogo (decifra o slug). Usado também pela ocorrência (T11).</summary>
    Task<IReadOnlyList<ContaVinculadaDto>> ListarVinculadasAsync(Guid usuarioId, CancellationToken ct);
}
