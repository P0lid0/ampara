using System.Text.Json.Serialization;

namespace Ampara.Domain.Cyber;

[JsonConverter(typeof(JsonStringEnumConverter<PiiClasse>))]
public enum PiiClasse { Cpf, Rg, Imei, Telefone, Email, Placa, Senha, Saude }

[JsonConverter(typeof(JsonStringEnumConverter<OrigemDado>))]
public enum OrigemDado
{
    [JsonStringEnumMemberName("http")] Http,
    [JsonStringEnumMemberName("form")] Form,
    [JsonStringEnumMemberName("query")] Query,
    [JsonStringEnumMemberName("header")] Header,
    [JsonStringEnumMemberName("mqtt")] Mqtt,
}

[JsonConverter(typeof(JsonStringEnumConverter<Sink>))]
public enum Sink { Log, HttpNaoAutenticada, HttpAutenticada, Erro, Ponte, SignalR, Llm, Banco }

[JsonConverter(typeof(JsonStringEnumConverter<Decisao>))]
public enum Decisao { Bloqueado, Mascarado, Permitido, Cifrado }

[JsonConverter(typeof(JsonStringEnumConverter<Farol>))]
public enum Farol
{
    [JsonStringEnumMemberName("verde")] Verde,
    [JsonStringEnumMemberName("amarelo")] Amarelo,
    [JsonStringEnumMemberName("vermelho")] Vermelho,
}
