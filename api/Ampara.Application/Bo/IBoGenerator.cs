using Ampara.Application.Comum;

namespace Ampara.Application.Bo;

public interface IBoGenerator
{
    /// <summary>Só o dono (escopo usuario ou emergencia). 409 momento-nao-marcado; 502 delegacias-indisponiveis.</summary>
    Task<BoDto> GerarAsync(Ator ator, Guid ocorrenciaId, CancellationToken ct, string? correlationId = null);
}
