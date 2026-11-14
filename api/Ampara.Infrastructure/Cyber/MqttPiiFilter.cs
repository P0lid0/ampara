using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Singleton. Percorre o JSON da mensagem, troca os valores sensíveis pela política do sink Banco (mascara; IMEI cifra)
/// e grava o rastro com origem Mqtt. Cada mensagem usa um escopo próprio (o guard é Scoped) e um correlation id próprio.
/// </summary>
public sealed class MqttPiiFilter(IServiceScopeFactory escopos, IPiiScanner scanner) : IMqttPiiFilter
{
    public const string PayloadInvalido = "[payload inválido]";

    /// <summary>
    /// Campos do contrato do chaveiro, definidos pelo firmware: nunca são sanitizados. O <c>ts</c> em segundos Unix
    /// (10 dígitos) casaria o detector de Telefone e quebraria o evento.
    /// </summary>
    private static readonly HashSet<string> CamposDoContrato = new(StringComparer.Ordinal) { "deviceId", "type", "eventId", "ts", "battery" };

    private static readonly JsonWriterOptions OpcoesEscrita = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public string Filtrar(string topico, string payload, string? correlationId = null)
    {
        try
        {
            using var doc = JsonDocument.Parse(payload ?? "");
            var raiz = doc.RootElement;
            var achados = scanner.EscanearJson(raiz).Where(a => !CamposDoContrato.Contains(a.Campo)).ToList();
            if (achados.Count == 0) return payload!;

            using var escopo = escopos.CreateScope();
            var sp = escopo.ServiceProvider;
            var guard = sp.GetRequiredService<ITaintGuard>();
            var taint = sp.GetRequiredService<ITaintScope>();
            var corr = string.IsNullOrWhiteSpace(correlationId) ? Guid.NewGuid().ToString() : correlationId;

            // Marcar faz o guard achar também o que só a chave denunciou (ex.: "senha"), sem padrão no texto.
            var porCampo = new Dictionary<string, AchadoPii>(StringComparer.Ordinal);
            foreach (var a in achados)
            {
                taint.Marcar(a.Valor, OrigemDado.Mqtt, a.Campo, a.Classe);
                porCampo.TryAdd(a.Campo, a);
            }

            var mudou = false;
            using var saida = new MemoryStream();
            using (var w = new Utf8JsonWriter(saida, OpcoesEscrita))
                Escrever(raiz, "", w, porCampo, guard, corr, ref mudou);
            return mudou ? Encoding.UTF8.GetString(saida.ToArray()) : payload!;
        }
        catch (Exception)
        {
            // JSON inválido ou falha ao proteger: fecha. O conteúdo nunca vai para o log nem para o banco.
            return PayloadInvalido;
        }
    }

    private static void Escrever(JsonElement no, string caminho, Utf8JsonWriter w, Dictionary<string, AchadoPii> alvos,
        ITaintGuard guard, string corr, ref bool mudou)
    {
        switch (no.ValueKind)
        {
            case JsonValueKind.Object:
                w.WriteStartObject();
                foreach (var p in no.EnumerateObject())
                {
                    w.WritePropertyName(p.Name);
                    Escrever(p.Value, caminho.Length == 0 ? p.Name : caminho + "." + p.Name, w, alvos, guard, corr, ref mudou);
                }
                w.WriteEndObject();
                break;
            case JsonValueKind.Array:
                w.WriteStartArray();
                var i = 0;
                foreach (var item in no.EnumerateArray())
                    Escrever(item, caminho + "[" + i++ + "]", w, alvos, guard, corr, ref mudou);
                w.WriteEndArray();
                break;
            case JsonValueKind.String when alvos.ContainsKey(caminho):
                var original = no.GetString() ?? "";
                var r = guard.Sanitizar(original, Sink.Banco, new SanitizarOpcoes(OrigemDado.Mqtt, caminho, CorrelationId: corr));
                if (r.Texto != original) mudou = true;
                w.WriteStringValue(r.Texto);
                break;
            case JsonValueKind.Number when alvos.ContainsKey(caminho):
                var bruto = no.GetRawText();
                var rn = guard.Sanitizar(bruto, Sink.Banco, new SanitizarOpcoes(OrigemDado.Mqtt, caminho, CorrelationId: corr));
                if (rn.Texto == bruto) { w.WriteRawValue(bruto); break; }
                mudou = true;
                w.WriteStringValue(rn.Texto);
                break;
            default:
                no.WriteTo(w);
                break;
        }
    }
}
