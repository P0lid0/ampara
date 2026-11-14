using Ampara.Application.Comum;

namespace Ampara.Application.Alertas;

/// <summary>Mesmo formato de <see cref="AlertaDisparadoMsg"/>.</summary>
public sealed record AlertaAtivoDto(Guid AlertaId, Guid OcorrenciaId, string VitimaNome, string Origem, DateTime Em);

public interface IEscalonamento
{
    /// <summary>Alerta ao guardião de menor Ordem e notifica. Sem guardiões: não faz nada.</summary>
    Task IniciarAsync(Guid ocorrenciaId, CancellationToken ct);

    /// <summary>Escala quem passou de TempoCiente sem ciente. Devolve quantas ocorrências escalou.</summary>
    Task<int> ProcessarVencidosAsync(CancellationToken ct);

    /// <summary>Só o guardião do alerta. Encerra os demais da ocorrência (motivo "ciente"). Repetir é inócuo.</summary>
    Task ConfirmarCienteAsync(Ator ator, Guid alertaId, CancellationToken ct);

    /// <summary>Motivo: "cancelado" | "encerrado".</summary>
    Task EncerrarAlertasAsync(Guid ocorrenciaId, string motivo, CancellationToken ct);

    Task<IReadOnlyList<AlertaAtivoDto>> AtivosAsync(Guid guardiaoUsuarioId, CancellationToken ct);
}
