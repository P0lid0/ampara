using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Registra no rastro uma tentativa de acesso indevido (código de emergência errado ou recurso de outro usuário).
/// O evento aponta para o DONO do dado, que é quem o índice de risco precisa proteger. Nunca lança.
/// </summary>
public sealed class AcessoIndevido(IRastroSeguranca rastro, ICorrelacao? correlacao = null) : IAcessoIndevido
{
    public void Registrar(Guid? usuarioAlvoId, string campo, string? correlationId = null)
    {
        try
        {
            var cid = correlationId ?? correlacao?.Id ?? "";
            rastro.Registrar(EventoSeguranca.Novo(TimeProvider.System.GetUtcNow(), cid, OrigemDado.Http, campo,
                PiiClasse.Senha, Sink.HttpNaoAutenticada, Decisao.Bloqueado, usuarioAlvoId));
        }
        catch { /* o rastro nunca altera o fluxo de quem chama */ }
    }
}
