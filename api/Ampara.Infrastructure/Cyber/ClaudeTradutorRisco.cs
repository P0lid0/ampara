using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Frases padrao (2 frases cada), usadas sem chave, com falha da API ou com resposta fora do padrao.</summary>
public static class FrasesPadrao
{
    public const string Bloqueado = "Tentaram usar um dado seu em um lugar inseguro, e nosso sistema bloqueou a ação para proteger sua privacidade. Você não precisa fazer nada agora.";
    public const string Protegido = "Guardamos seus dados com proteção, escondendo ou embaralhando o que é sensível. Você não precisa fazer nada.";
    public const string Permitido = "Mostramos um dado seu somente para você, no lugar certo. Nenhuma ação é necessária.";
    public const string AcessoIndevido = "Alguém tentou entrar em uma área sua sem permissão, e nosso sistema barrou a tentativa. Troque seu código de emergência se a tentativa não foi sua.";
    public const string FalhaSistema = "Algo deu errado do nosso lado e a ação não foi concluída. Tente de novo em alguns minutos; seus dados continuam protegidos.";

    public static IReadOnlyList<string> Todas { get; } = [Bloqueado, Protegido, Permitido, AcessoIndevido, FalhaSistema];

    public static string Para(string tipo) => tipo switch
    {
        nameof(Decisao.Bloqueado) => Bloqueado,
        nameof(Decisao.Mascarado) or nameof(Decisao.Cifrado) => Protegido,
        nameof(Decisao.Permitido) => Permitido,
        EventoTecnico.AcessoIndevido => AcessoIndevido,
        _ => FalhaSistema,
    };
}

/// <summary>
/// Traduz o evento pela Messages API da Anthropic. So categoria, sink e tipo entram no prompt, e o prompt ainda passa pelo
/// guard (sink Llm). Sem chave, com erro, timeout (5 s no total) ou resposta fora do padrao: frase padrao, sem lancar.
/// </summary>
public sealed class ClaudeTradutorRisco(
    IHttpClientFactory http, IConfiguration config, ITaintGuard guard, IMemoryCache cache, ILogger<ClaudeTradutorRisco> log) : ITradutorRisco
{
    public const string ModeloPadrao = "claude-haiku-5-5";
    private const string Url = "https://api.anthropic.com/v1/messages";
    private const string Sistema = "Você escreve avisos curtos e calmos em português do Brasil.";
    private static readonly TimeSpan Limite = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan Validade = TimeSpan.FromHours(1);
    // Sem escape de unicode: aspas simples e acentos seguem legiveis no corpo (e nada vira sequencia de digitos).
    private static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public async Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default)
    {
        var padrao = FrasesPadrao.Para(evento.Tipo);
        try
        {
            var chave = config["ANTHROPIC_API_KEY"];
            if (string.IsNullOrWhiteSpace(chave)) return padrao;

            var prompt = $"Traduza a falha técnica '{evento.Categoria} no {evento.Sink}: {evento.Tipo}' para um cidadão leigo de 60 anos, em 2 frases: a primeira diz o que aconteceu e a segunda diz o que a pessoa deve fazer. Não use termos técnicos e não repita nenhum dado pessoal.";
            var limpo = guard.Sanitizar(prompt, Sink.Llm);
            // Um valor escondido em categoria, sink ou tipo seria trocado ou bloqueado aqui: nada sai.
            if (limpo.Bloqueado || limpo.Texto != prompt) return FrasesPadrao.FalhaSistema;

            var cacheKey = $"{evento.Categoria}|{evento.Sink}|{evento.Tipo}";
            if (cache.TryGetValue(cacheKey, out string? guardada) && guardada is not null) return guardada;

            var modelo = config["ANTHROPIC_MODEL"];
            if (string.IsNullOrWhiteSpace(modelo)) modelo = ModeloPadrao;

            using var prazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
            prazo.CancelAfter(Limite);
            using var req = new HttpRequestMessage(HttpMethod.Post, Url)
            {
                Content = JsonContent.Create(new
                {
                    model = modelo, max_tokens = 200, system = Sistema,
                    messages = new[] { new { role = "user", content = limpo.Texto } },
                }, options: Json),
            };
            req.Headers.Add("x-api-key", chave);
            req.Headers.Add("anthropic-version", "2023-06-01");

            using var resp = await http.CreateClient("anthropic").SendAsync(req, prazo.Token);
            if (!resp.IsSuccessStatusCode)
            {
                log.LogWarning("Tradutor de risco: Anthropic respondeu {Status}", (int)resp.StatusCode);
                return padrao;
            }
            var texto = Extrair(await resp.Content.ReadAsStringAsync(prazo.Token))?.Trim();
            if (texto is null || texto.Length is < 20 or > 300) return padrao;

            cache.Set(cacheKey, texto, Validade);
            return texto;
        }
        catch (Exception ex)
        {
            // So o tipo da excecao: a mensagem poderia carregar trechos de requisicao.
            log.LogWarning("Tradutor de risco caiu na frase padrao: {Tipo}", ex.GetType().Name);
            return padrao;
        }
    }

    private static string? Extrair(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var c = doc.RootElement.GetProperty("content");
        return c.ValueKind == JsonValueKind.Array && c.GetArrayLength() > 0 && c[0].TryGetProperty("text", out var t) ? t.GetString() : null;
    }
}
