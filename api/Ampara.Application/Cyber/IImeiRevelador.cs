namespace Ampara.Application.Cyber;

public interface IImeiRevelador
{
    string RevelarParaBo(string imeiCifrado, Guid donoId, Guid solicitanteId, string? correlationId = null);
}
