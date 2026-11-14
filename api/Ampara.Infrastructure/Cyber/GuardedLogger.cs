using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Logger que passa a mensagem formatada (e o texto da exceção) pelo <see cref="ITaintGuard"/> com <see cref="Sink.Log"/>
/// antes de entregá-la ao logger real. Categoria, nível e <see cref="EventId"/> seguem como vieram; <c>Sensitive&lt;T&gt;</c>
/// já se formata como <c>[PII:Classe]</c>. Se a sanitização falhar, o conteúdo é descartado (falha fechada).
/// </summary>
public sealed class GuardedLogger(ILogger inner, Func<ITaintGuard> guard) : ILogger
{
    public const string Suprimido = "[log suprimido: falha ao sanitizar]";

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, byte> JaAvisados = new();

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => inner.BeginScope(state);

    public bool IsEnabled(LogLevel logLevel) => inner.IsEnabled(logLevel);

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!inner.IsEnabled(logLevel)) return;
        string texto;
        try
        {
            var bruto = formatter(state, exception);
            if (exception is not null) bruto = $"{bruto}{Environment.NewLine}{exception}";
            texto = guard().Sanitizar(bruto, Sink.Log).Texto;
        }
        catch (Exception falha)
        {
            // So o TIPO da falha: Message pode carregar o valor sensivel.
            var tipo = falha.GetType().Name;
            texto = $"{Suprimido[..^1]} ({tipo})]";
            if (JaAvisados.TryAdd(tipo, 0))
                Console.Error.WriteLine($"[Cyber] GuardedLogger: falha ao sanitizar log ({tipo}); linhas suprimidas.");
        }
        inner.Log(logLevel, eventId, texto, null, static (s, _) => s);
    }
}
