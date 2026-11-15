using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Montagem unica da chamada a Messages API da Anthropic (URL, versao, cabecalhos, modelo, timeout de 5 s e corpo), usada pelo
/// tradutor de risco e pelo moderador de relato para os dois nunca divergirem.
/// </summary>
public static class AnthropicMensagens
{
    public const string ModeloPadrao = "claude-haiku-5-5";
    public const string Url = "https://api.anthropic.com/v1/messages";
    public const string Versao = "2023-06-01";
    public static readonly TimeSpan Limite = TimeSpan.FromSeconds(5);
    // Sem escape de unicode: aspas simples e acentos seguem legiveis no corpo (e nada vira sequencia de digitos).
    private static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static string? Chave(IConfiguration config) =>
        string.IsNullOrWhiteSpace(config["ANTHROPIC_API_KEY"]) ? null : config["ANTHROPIC_API_KEY"];

    /// <summary>
    /// Devolve o texto da resposta, ou null (sem chave, status nao 2xx, resposta sem texto). Falhas de rede, timeout e JSON invalido
    /// sobem como excecao para o chamador decidir o fallback. O prazo de 5 s vale para a chamada inteira.
    /// </summary>
    public static async Task<string?> EnviarAsync(
        IHttpClientFactory http, IConfiguration config, string prompt, int maxTokens, string? sistema,
        ILogger log, string rotulo, CancellationToken ct)
    {
        var chave = Chave(config);
        if (chave is null) return null;
        var modelo = config["ANTHROPIC_MODEL"];
        if (string.IsNullOrWhiteSpace(modelo)) modelo = ModeloPadrao;

        using var prazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        prazo.CancelAfter(Limite);
        var mensagens = new[] { new { role = "user", content = prompt } };
        object corpo = sistema is null
            ? new { model = modelo, max_tokens = maxTokens, messages = mensagens }
            : new { model = modelo, max_tokens = maxTokens, system = sistema, messages = mensagens };
        using var req = new HttpRequestMessage(HttpMethod.Post, Url) { Content = JsonContent.Create(corpo, options: Json) };
        req.Headers.Add("x-api-key", chave);
        req.Headers.Add("anthropic-version", Versao);

        using var resp = await http.CreateClient("anthropic").SendAsync(req, prazo.Token);
        if (!resp.IsSuccessStatusCode)
        {
            log.LogWarning("{Rotulo}: Anthropic respondeu {Status}", rotulo, (int)resp.StatusCode);
            return null;
        }
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(prazo.Token));
        var c = doc.RootElement.GetProperty("content");
        return c.ValueKind == JsonValueKind.Array && c.GetArrayLength() > 0 && c[0].TryGetProperty("text", out var t) ? t.GetString() : null;
    }
}
