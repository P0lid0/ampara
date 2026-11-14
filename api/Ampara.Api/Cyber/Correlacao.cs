using Ampara.Application.Cyber;

namespace Ampara.Api.Cyber;

/// <summary>ICorrelacao escopado; o <c>CorrelacaoMiddleware</c> preenche o <see cref="Id"/>.</summary>
public sealed class Correlacao : ICorrelacao
{
    public string Id { get; set; } = "";
}
