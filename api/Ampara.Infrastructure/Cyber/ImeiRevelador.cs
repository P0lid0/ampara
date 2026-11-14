using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Único ponto que decifra o IMEI, e só para o BO do próprio dono. O dono recebe o IMEI e o evento
/// Imei/HttpAutenticada/Permitido (campo "bo.imei") fica no rastro; qualquer outro solicitante vira acesso indevido
/// contra o dono (peso 40 no índice) e leva <see cref="AcessoNegadoException"/> (403 pelo ProblemaHandler).
/// O IMEI em claro só existe dentro da resposta autenticada do BO: o rastro guarda classe e campo, nunca o valor.
/// </summary>
public sealed class ImeiRevelador(IPiiProtetor protetor, IRastroSeguranca rastro, IAcessoIndevido acessoIndevido,
    ICorrelacao? correlacao = null, TimeProvider? tempo = null) : IImeiRevelador
{
    public const string CampoBo = "bo.imei";

    public string RevelarParaBo(string imeiCifrado, Guid donoId, Guid solicitanteId, string? correlationId = null)
    {
        if (solicitanteId != donoId)
        {
            acessoIndevido.Registrar(donoId, IndiceRisco.CampoRecursoOutroUsuario, correlationId);
            throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
        }

        var imei = protetor.Decifrar(imeiCifrado);
        try
        {
            var cid = correlationId ?? correlacao?.Id ?? "";
            rastro.Registrar(EventoSeguranca.Novo((tempo ?? TimeProvider.System).GetUtcNow(), cid, OrigemDado.Http, CampoBo,
                PiiClasse.Imei, Sink.HttpAutenticada, Decisao.Permitido, donoId));
        }
        catch { /* o rastro nunca altera o fluxo de quem chama */ }
        return imei;
    }
}
