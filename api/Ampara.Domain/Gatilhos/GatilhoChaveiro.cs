using Ampara.Domain.Entidades;

namespace Ampara.Domain.Gatilhos;

/// <summary>Alerta vindo do chaveiro. O início é o do clique, nunca depois de agora (o relógio do aparelho pode adiantar).</summary>
public sealed class GatilhoChaveiro(string deviceId, string alertId, DateTime emClique) : IGatilho
{
    public OrigemGatilho Origem => OrigemGatilho.Chaveiro;

    public Ocorrencia CriarOcorrencia(Guid vitimaId, DateTime agora)
    {
        var clique = emClique.Kind == DateTimeKind.Utc ? emClique : emClique.ToUniversalTime();
        var o = Ocorrencia.Iniciar(vitimaId, Origem, clique < agora ? clique : agora);
        o.ChaveiroDeviceId = deviceId;
        o.ChaveiroAlertId = alertId;
        return o;
    }

    public void Reaproveitar(Ocorrencia aberta) => aberta.VincularChaveiro(deviceId, alertId);
}
