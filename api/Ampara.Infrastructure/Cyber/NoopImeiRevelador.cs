using Ampara.Application.Comum;
using Ampara.Application.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Só decifra e devolve. O plano 03 substitui por versão que grava o evento Imei/HttpAutenticada/Permitido (campo "bo.imei").</summary>
public sealed class NoopImeiRevelador(ICifrador cifrador) : IImeiRevelador
{
    public string RevelarParaBo(string imeiCifrado, Guid donoId, Guid solicitanteId, string? correlationId = null)
        => cifrador.Decifrar(imeiCifrado);
}
