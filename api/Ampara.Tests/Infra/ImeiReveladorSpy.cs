using System.Collections.Concurrent;
using Ampara.Application.Cyber;

namespace Ampara.Tests.Infra;

/// <summary>Registra as chamadas a IImeiRevelador e delega ao revelador real (no-op do plano 02, que só decifra).</summary>
public sealed class ImeiReveladorSpy(Func<IImeiRevelador> interno) : IImeiRevelador
{
    public sealed record Chamada(string ImeiCifrado, Guid DonoId, Guid SolicitanteId, string? CorrelationId, string Retorno);

    private readonly ConcurrentQueue<Chamada> _chamadas = new();

    public IReadOnlyList<Chamada> Chamadas => _chamadas.ToArray();

    public string RevelarParaBo(string imeiCifrado, Guid donoId, Guid solicitanteId, string? correlationId = null)
    {
        var r = interno().RevelarParaBo(imeiCifrado, donoId, solicitanteId, correlationId);
        _chamadas.Enqueue(new Chamada(imeiCifrado, donoId, solicitanteId, correlationId, r));
        return r;
    }
}
