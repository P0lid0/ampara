using Ampara.Domain.Entidades;

namespace Ampara.Domain.Gatilhos;

/// <summary>Disparo por um guardião em nome da vítima.</summary>
public sealed class GatilhoGuardiao(Guid guardiaoUsuarioId) : IGatilho
{
    public Guid GuardiaoUsuarioId { get; } = guardiaoUsuarioId;

    public OrigemGatilho Origem => OrigemGatilho.Guardiao;

    public Ocorrencia CriarOcorrencia(Guid vitimaId, DateTime agora) => Ocorrencia.Iniciar(vitimaId, Origem, agora);
}
