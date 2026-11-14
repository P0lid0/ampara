using Ampara.Application.Cyber;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// <see cref="ILoggerFactory"/> que embrulha a fábrica real: todo logger criado (inclusive os de <c>ILogger&lt;T&gt;</c>)
/// passa pelo guard. O guard é resolvido a cada log, para usar o escopo da requisição em andamento.
/// </summary>
public sealed class GuardedLoggerFactory(ILoggerFactory inner, Func<ITaintGuard> guard) : ILoggerFactory
{
    public ILogger CreateLogger(string categoryName) => new GuardedLogger(inner.CreateLogger(categoryName), guard);

    public void AddProvider(ILoggerProvider provider) => inner.AddProvider(provider);

    public void Dispose() => inner.Dispose();
}
