using Ampara.Domain.Entidades;

namespace Ampara.Domain.Gatilhos;

/// <summary>Impacto detectado pelo chaveiro. Abre a ocorrência com 10 s de janela para cancelar antes de qualquer alerta.</summary>
public sealed class GatilhoImpacto(string deviceId, string alertId, DateTime emClique) : IGatilho
{
    public static readonly TimeSpan Janela = TimeSpan.FromSeconds(10);

    public OrigemGatilho Origem => OrigemGatilho.Impacto;

    public Ocorrencia CriarOcorrencia(Guid vitimaId, DateTime agora)
    {
        var clique = emClique.Kind == DateTimeKind.Utc ? emClique : emClique.ToUniversalTime();
        var o = Ocorrencia.Iniciar(vitimaId, Origem, clique < agora ? clique : agora);
        o.ChaveiroDeviceId = deviceId;
        o.ChaveiroAlertId = alertId;
        o.AlertasLiberadosEm = o.IniciadaEm + Janela;
        return o;
    }
}
