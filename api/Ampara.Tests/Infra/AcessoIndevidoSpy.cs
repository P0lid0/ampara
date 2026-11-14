using System.Collections.Concurrent;
using Ampara.Application.Cyber;

namespace Ampara.Tests.Infra;

/// <summary>Registra as chamadas a IAcessoIndevido (substitui o no-op nos testes).</summary>
public sealed class AcessoIndevidoSpy : IAcessoIndevido
{
    public sealed record Chamada(Guid? UsuarioAlvoId, string Campo, string? CorrelationId);

    private readonly ConcurrentQueue<Chamada> _chamadas = new();

    public IReadOnlyList<Chamada> Chamadas => _chamadas.ToArray();

    public void Limpar() => _chamadas.Clear();

    public void Registrar(Guid? usuarioAlvoId, string campo, string? correlationId = null)
        => _chamadas.Enqueue(new Chamada(usuarioAlvoId, campo, correlationId));
}
