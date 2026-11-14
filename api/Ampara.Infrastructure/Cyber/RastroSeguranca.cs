using System.Threading.Channels;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Fila limitada (1000, descarta o mais antigo). Registrar nunca bloqueia nem lanca.</summary>
public sealed class RastroSeguranca : IRastroSeguranca
{
    public const int Capacidade = 1000;

    private readonly Channel<EventoSeguranca> _canal = Channel.CreateBounded<EventoSeguranca>(
        new BoundedChannelOptions(Capacidade) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    public ChannelReader<EventoSeguranca> Leitor => _canal.Reader;

    public void Registrar(EventoSeguranca e)
    {
        try { _canal.Writer.TryWrite(e); }
        catch { /* o rastro nunca derruba quem o chama */ }
    }
}
