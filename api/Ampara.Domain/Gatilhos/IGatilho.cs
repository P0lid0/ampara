using Ampara.Domain.Entidades;

namespace Ampara.Domain.Gatilhos;

/// <summary>Quem dispara uma ocorrência (chaveiro, web, guardião, impacto). Cada gatilho sabe montar a sua.</summary>
public interface IGatilho
{
    OrigemGatilho Origem { get; }
    Ocorrencia CriarOcorrencia(Guid vitimaId, DateTime agora);
}
