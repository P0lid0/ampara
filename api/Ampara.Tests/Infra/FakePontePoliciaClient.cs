using System.Collections.Concurrent;
using Ampara.Application.Comum;
using Ampara.Application.Policia;

namespace Ampara.Tests.Infra;

/// <summary>Ponte falsa: grava o que recebeu, numera protocolos (mesmo origem_id devolve o mesmo) e pode falhar sob comando.</summary>
public sealed class FakePontePoliciaClient : IPontePoliciaClient
{
    private readonly ConcurrentQueue<PonteOcorrencia> _enviadas = new();
    private readonly ConcurrentDictionary<Guid, string> _protocolos = new();
    private int _contador;

    public IReadOnlyList<PonteOcorrencia> Enviadas => _enviadas.ToArray();

    /// <summary>Quando verdadeiro, EnviarAsync e ObterRetornoAsync lançam ponte-indisponivel.</summary>
    public volatile bool Falhar;

    public Func<string, PonteRetorno?> Retorno { get; set; } = protocolo =>
        new PonteRetorno(protocolo, "recebida", "Recebemos o seu relato.", new DateTime(2026, 11, 14, 22, 0, 0, DateTimeKind.Utc));

    public Task<PonteProtocolo> EnviarAsync(PonteOcorrencia o, CancellationToken ct)
    {
        if (Falhar) throw new ServicoIndisponivelException("ponte-indisponivel");
        _enviadas.Enqueue(o);
        var protocolo = _protocolos.GetOrAdd(o.OrigemId, _ => $"PP-2026-{Interlocked.Increment(ref _contador):000000}");
        return Task.FromResult(new PonteProtocolo(protocolo, "recebida"));
    }

    public Task<PonteRetorno?> ObterRetornoAsync(string protocolo, CancellationToken ct)
    {
        if (Falhar) throw new ServicoIndisponivelException("ponte-indisponivel");
        return Task.FromResult(Retorno(protocolo));
    }
}
