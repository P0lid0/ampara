using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Application.Comum;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Modera o texto livre do relato: primeiro tira toda PII (o texto que sai para a Claude e o que volta aprovado e sempre o limpo),
/// depois pede a classificacao (ABUSIVO ou OK). Sem chave, erro, timeout ou resposta fora do padrao: devolve null (relato aceito
/// sem texto), sem lancar. O texto nunca vai para log nem para mensagem de erro.
/// </summary>
public sealed class ClaudeModeradorRelato(
    IHttpClientFactory http, IConfiguration config, IPiiScanner scanner, ILogger<ClaudeModeradorRelato> log) : IModeradorRelato
{
    public const int MaxCaracteres = 280;
    public const string Marcador = "[dado removido]";
    private const string Url = "https://api.anthropic.com/v1/messages";
    private static readonly TimeSpan Limite = TimeSpan.FromSeconds(5);
    private static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public async Task<string?> ModerarTextoAsync(string texto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        if (texto.Length > MaxCaracteres) texto = texto[..MaxCaracteres];
        var limpo = Limpar(texto);

        // A decisao de barrar (relato-abusivo) fica fora do try: so a falha de infraestrutura cai no fallback.
        string? veredito;
        try
        {
            veredito = await ClassificarAsync(limpo, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            // So o tipo da excecao: a mensagem poderia carregar trechos da requisicao.
            log.LogWarning("Moderador de relato caiu no fallback sem texto: {Tipo}", ex.GetType().Name);
            return null;
        }

        if (veredito is null) return null;
        if (veredito == "ABUSIVO") throw new DominioException("relato-abusivo");
        return veredito == "OK" ? limpo : null;
    }

    /// <summary>Troca cada trecho achado pelos detectores por <see cref="Marcador"/>. O texto sai normalizado.</summary>
    private string Limpar(string texto)
    {
        var norm = Normalizador.Normalizar(texto);
        var sb = new StringBuilder(norm.Length);
        var pos = 0;
        foreach (var d in scanner.Localizar(norm).OrderBy(d => d.Inicio))
        {
            var fim = d.Inicio + d.Tamanho;
            if (fim <= pos) continue;                       // dentro de um trecho ja trocado
            if (d.Inicio > pos) sb.Append(norm, pos, d.Inicio - pos);
            sb.Append(Marcador);
            pos = fim;
        }
        if (pos < norm.Length) sb.Append(norm, pos, norm.Length - pos);
        return sb.ToString();
    }

    private async Task<string?> ClassificarAsync(string limpo, CancellationToken ct)
    {
        var chave = config["ANTHROPIC_API_KEY"];
        if (string.IsNullOrWhiteSpace(chave)) return null;
        var modelo = config["ANTHROPIC_MODEL"];
        if (string.IsNullOrWhiteSpace(modelo)) modelo = ClaudeTradutorRisco.ModeloPadrao;

        var prompt = $"Você modera relatos curtos de segurança urbana feitos por cidadãos. Responda só com uma palavra: ABUSIVO se o texto tiver propaganda ou opinião política, ofensa ou xingamento, ou descrever pessoas (aparência, roupa, cor da pele, características físicas ou nome); caso contrário, responda OK. Texto: «{limpo}»";

        using var prazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        prazo.CancelAfter(Limite);
        using var req = new HttpRequestMessage(HttpMethod.Post, Url)
        {
            Content = JsonContent.Create(new
            {
                model = modelo, max_tokens = 5,
                messages = new[] { new { role = "user", content = prompt } },
            }, options: Json),
        };
        req.Headers.Add("x-api-key", chave);
        req.Headers.Add("anthropic-version", "2023-06-01");

        using var resp = await http.CreateClient("anthropic").SendAsync(req, prazo.Token);
        if (!resp.IsSuccessStatusCode)
        {
            log.LogWarning("Moderador de relato: Anthropic respondeu {Status}", (int)resp.StatusCode);
            return null;
        }
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(prazo.Token));
        var c = doc.RootElement.GetProperty("content");
        var bruto = c.ValueKind == JsonValueKind.Array && c.GetArrayLength() > 0 && c[0].TryGetProperty("text", out var t) ? t.GetString() : null;
        if (string.IsNullOrWhiteSpace(bruto)) return null;

        var palavra = new string(bruto.Where(char.IsLetter).ToArray()).ToUpperInvariant();
        if (palavra.StartsWith("ABUSIVO", StringComparison.Ordinal)) return "ABUSIVO";
        if (palavra.StartsWith("OK", StringComparison.Ordinal)) return "OK";
        return null;
    }
}
