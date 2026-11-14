using Ampara.Application.Comum;

namespace Ampara.Application.Policia;

public interface IPoliciaService
{
    /// <summary>Só o dono (ou a emergência dele). Devolve o protocolo; repetir devolve o mesmo sem chamar a Ponte.</summary>
    Task<string> CompartilharAsync(Ator ator, Guid ocorrenciaId, bool consentimento, CancellationToken ct);

    Task<RetornoDto> RetornoAsync(Ator ator, Guid ocorrenciaId, CancellationToken ct);

    /// <summary>Número do BO e situação da recuperação. Ficam só na API: nunca vão para a Ponte.</summary>
    Task DefinirAcompanhamentoAsync(Ator ator, Guid ocorrenciaId, AcompanhamentoEntrada e, CancellationToken ct);
}
