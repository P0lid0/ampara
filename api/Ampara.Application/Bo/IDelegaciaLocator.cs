namespace Ampara.Application.Bo;

public interface IDelegaciaLocator
{
    /// <summary>Delegacia mais próxima (distância haversine) ou null quando nenhuma foi carregada.</summary>
    Delegacia? MaisProxima(double lat, double lng);
}
