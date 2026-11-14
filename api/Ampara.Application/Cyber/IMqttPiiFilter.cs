namespace Ampara.Application.Cyber;

/// <summary>
/// Filtro de PII das mensagens MQTT do chaveiro: roda antes de logar ou persistir o evento e devolve o payload a despachar.
/// </summary>
public interface IMqttPiiFilter
{
    /// <summary>
    /// Mascara (ou cifra, no caso do IMEI) os valores sensíveis do JSON, com origem Mqtt e sink Banco, e grava o rastro.
    /// Payload limpo volta como a mesma string; o que não for JSON válido volta <c>"[payload inválido]"</c>. Nunca lança.
    /// </summary>
    string Filtrar(string topico, string payload, string? correlationId = null);
}
