using Ampara.Application.Comum;
using Ampara.Domain;
using Ampara.Domain.Gatilhos;

namespace Ampara.Application.Ocorrencias;

public interface IOcorrenciaService
{
    /// <summary>Reaproveita a ocorrência Aberta da vítima (Nova=false) ou cria uma pelo gatilho.</summary>
    Task<OcorrenciaCriada> DispararAsync(IGatilho gatilho, Guid vitimaId, CancellationToken ct);

    Task<OcorrenciaDto> ObterAsync(Ator ator, Guid id, CancellationToken ct);

    /// <summary>Dono/emergência: as próprias; usuário-guardião: também as das vítimas. Máximo 50, as mais recentes primeiro.</summary>
    Task<IReadOnlyList<OcorrenciaDto>> ListarAsync(Ator ator, CancellationToken ct);

    Task MarcarMomentoAsync(Ator ator, Guid id, DateTime em, double lat, double lng, CancellationToken ct);

    /// <summary>Só o guardião da vítima. Idempotente; o 5º passo encerra a ocorrência e os alertas.</summary>
    Task ConcluirPassoAsync(Ator ator, Guid ocorrenciaId, PassoBloqueio passo, CancellationToken ct);

    /// <summary>Dono ou emergência do dono. Origem chaveiro publica resolve no gateway.</summary>
    Task CancelarAsync(Ator ator, Guid id, CancellationToken ct);

    /// <summary>Evento "cancel" do chaveiro: cancela a Aberta daquele alerta sem devolver resolve (o chaveiro já sabe).</summary>
    Task CancelarPorChaveiroAsync(string deviceId, string alertId, CancellationToken ct);
}
