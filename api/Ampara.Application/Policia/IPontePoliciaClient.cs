namespace Ampara.Application.Policia;

public interface IPontePoliciaClient
{
    /// <summary>POST /ocorrencias. Qualquer falha (não-2xx, timeout, rede) vira ServicoIndisponivelException("ponte-indisponivel").</summary>
    Task<PonteProtocolo> EnviarAsync(PonteOcorrencia o, CancellationToken ct);

    /// <summary>GET /ocorrencias/{protocolo}/retorno. Nulo se a Ponte responde 404.</summary>
    Task<PonteRetorno?> ObterRetornoAsync(string protocolo, CancellationToken ct);
}
