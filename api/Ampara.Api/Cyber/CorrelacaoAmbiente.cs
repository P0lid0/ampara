using Ampara.Api.Middleware;
using Ampara.Application.Cyber;

namespace Ampara.Api.Cyber;

/// <summary>ICorrelacao para serviços singleton: lê o id da requisição corrente (vazio fora de uma requisição).</summary>
public sealed class CorrelacaoAmbiente(IHttpContextAccessor http) : ICorrelacao
{
    public string Id => http.HttpContext?.Items[CorrelacaoMiddleware.ItemKey] as string ?? "";
}
