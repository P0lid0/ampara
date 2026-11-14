using Ampara.Domain.Entidades;

namespace Ampara.Domain.Gatilhos;

/// <summary>Disparo pela web de emergência (token de escopo emergencia).</summary>
public sealed class GatilhoWeb : IGatilho
{
    public OrigemGatilho Origem => OrigemGatilho.Web;

    public Ocorrencia CriarOcorrencia(Guid vitimaId, DateTime agora) => Ocorrencia.Iniciar(vitimaId, Origem, agora);
}
