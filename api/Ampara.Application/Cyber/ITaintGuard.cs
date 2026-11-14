using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

public sealed record SanitizarOpcoes(OrigemDado? Origem = null, string? Campo = null, Guid? UsuarioAlvoId = null, string? CorrelationId = null);

public sealed record ResultadoTaint(string Texto, bool Bloqueado, IReadOnlyList<EventoSeguranca> Eventos);

public interface ITaintGuard
{
    bool Ativo { get; }
    ResultadoTaint Sanitizar(string texto, Sink sink, SanitizarOpcoes? o = null);
}
