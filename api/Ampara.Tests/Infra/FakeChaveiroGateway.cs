using System.Collections.Concurrent;
using Ampara.Application.Chaveiros;

namespace Ampara.Tests.Infra;

/// <summary>Grava os comandos que iriam ao MQTT (substitui o gateway real nos testes).</summary>
public sealed class FakeChaveiroGateway : IChaveiroGateway
{
    public sealed record Publicado(string DeviceId, ComandoChaveiro Cmd);

    private readonly ConcurrentQueue<Publicado> _publicados = new();

    public bool Conectado { get; set; } = true;

    public IReadOnlyList<Publicado> Publicados => _publicados.ToArray();

    public void Limpar() => _publicados.Clear();

    public Task PublicarComandoAsync(string deviceId, ComandoChaveiro cmd, CancellationToken ct)
    {
        _publicados.Enqueue(new Publicado(deviceId, cmd));
        return Task.CompletedTask;
    }
}
