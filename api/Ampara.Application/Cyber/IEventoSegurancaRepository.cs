using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>Fila do rastro de seguranca. Nunca lanca: registrar nao pode derrubar a requisicao.</summary>
public interface IRastroSeguranca
{
    void Registrar(EventoSeguranca e);
}

public interface IEventoSegurancaRepository
{
    Task AdicionarAsync(EventoSeguranca e, CancellationToken ct = default);

    /// <summary>Eventos com <c>Em &gt;= desde</c>; com <paramref name="usuarioAlvoId"/>, so os desse usuario.</summary>
    Task<IReadOnlyList<EventoSeguranca>> DesdeAsync(DateTimeOffset desde, Guid? usuarioAlvoId, CancellationToken ct = default);
}
