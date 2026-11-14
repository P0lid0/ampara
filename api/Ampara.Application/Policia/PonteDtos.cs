using System.Text.Json.Serialization;

namespace Ampara.Application.Policia;

// Contrato da Ponte Polícia (JSON em snake_case). O payload de envio não tem nenhum dado pessoal:
// só a área da grade, o instante, o tipo, a origem do gatilho, o hash do dispositivo e a trilha.
public sealed record PontoTrilha(
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lng")] double Lng,
    [property: JsonPropertyName("em")] DateTime Em);

public sealed record PonteOcorrencia(
    [property: JsonPropertyName("origem_id")] Guid OrigemId,
    [property: JsonPropertyName("area_id")] string AreaId,
    [property: JsonPropertyName("ts")] DateTime Ts,
    [property: JsonPropertyName("tipo")] string Tipo,
    [property: JsonPropertyName("origem_gatilho")] string OrigemGatilho,
    [property: JsonPropertyName("device_hash")] string DeviceHash,
    [property: JsonPropertyName("trilha")] IReadOnlyList<PontoTrilha> Trilha);

public sealed record PonteProtocolo(
    [property: JsonPropertyName("protocolo")] string Protocolo,
    [property: JsonPropertyName("status")] string Status);

public sealed record PonteRetorno(
    [property: JsonPropertyName("protocolo")] string Protocolo,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("mensagem")] string Mensagem,
    [property: JsonPropertyName("atualizado_em")] DateTime AtualizadoEm);

/// <summary>Resposta de GET /ocorrencias/{id}/retorno (camelCase pelo padrão web). Os quatro primeiros campos vêm da Ponte; os três últimos, do acompanhamento gravado.</summary>
public sealed record RetornoDto(string Protocolo, string Status, string Mensagem, DateTime AtualizadoEm, string? BoNumero, string BoStatus, string Recuperacao);

public sealed record AcompanhamentoEntrada(string? BoNumero, string BoStatus, string Recuperacao);

public sealed record CompartilharEntrada(bool Consentimento);

/// <summary>Chave de serviço compartilhada com a Ponte (PONTE_CHAVE_SERVICO). Nunca é logada.</summary>
public sealed record OpcoesPonte(string ChaveServico);
