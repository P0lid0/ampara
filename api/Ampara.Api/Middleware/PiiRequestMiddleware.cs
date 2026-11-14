using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Options;

namespace Ampara.Api.Middleware;

/// <summary>
/// Lê a requisição (corpo JSON, form, multipart sem arquivos, query e cabeçalhos) e marca cada dado sensível no
/// <see cref="ITaintScope"/>, para o sink reconhecê-lo na saída. Não bloqueia: a decisão é no sink.
/// O corpo é rebobinado e o endpoint o lê normalmente.
/// </summary>
public sealed class PiiRequestMiddleware(RequestDelegate next, IPiiScanner scanner, IOptions<CyberOptions> opcoes)
{
    private static readonly JsonSerializerOptions JsonProblema = new(JsonSerializerDefaults.Web);

    // Cabeçalhos de protocolo, sem dado do cidadão: pular evita marcar ruído.
    private static readonly HashSet<string> CabecalhosIgnorados = new(StringComparer.OrdinalIgnoreCase)
    {
        "Host", "User-Agent", "Accept", "Accept-Encoding", "Accept-Language", "Connection", "Content-Type",
        "Content-Length", "Origin", "Referer", "X-Correlation-Id", "Transfer-Encoding", "Upgrade",
    };

    public async Task InvokeAsync(HttpContext ctx, ITaintScope escopo)
    {
        var o = opcoes.Value;
        if (!o.Efetivo) { await next(ctx); return; }

        var req = ctx.Request;
        var chavesExtras = ChavesDaRota(o, req.Path);

        // Query e cabeçalhos
        Marcar(escopo, scanner.EscanearPares(req.Query.SelectMany(q => q.Value.Select(v => new KeyValuePair<string, string?>(q.Key, v))), chavesExtras), OrigemDado.Query);
        Marcar(escopo, scanner.EscanearPares(req.Headers.Where(h => !CabecalhosIgnorados.Contains(h.Key))
            .SelectMany(h => h.Value.Select(v => new KeyValuePair<string, string?>(h.Key, v))), chavesExtras), OrigemDado.Header);

        var tipo = Tipo(req.ContentType);
        var temCorpo = tipo is not null && (req.ContentLength is null or > 0);
        if (temCorpo && req.ContentLength > o.LimiteCorpoBytes)
        {
            await Problema(ctx, StatusCodes.Status413PayloadTooLarge, "corpo-grande", "Corpo da requisição acima do limite.");
            return;
        }

        if (temCorpo && (EhJson(tipo!) || tipo == "application/x-www-form-urlencoded" || tipo == "multipart/form-data"))
        {
            var bytes = await LerLimitadoAsync(req.Body, o.LimiteCorpoBytes, ctx.RequestAborted);
            if (bytes is null)
            {
                await Problema(ctx, StatusCodes.Status413PayloadTooLarge, "corpo-grande", "Corpo da requisição acima do limite.");
                return;
            }
            req.Body = new MemoryStream(bytes, writable: false);   // o endpoint lê do começo

            if (EhJson(tipo!))
            {
                if (Profundidade(bytes) > o.MaxProfundidadeJson)
                {
                    await Problema(ctx, StatusCodes.Status400BadRequest, "json-profundo", "JSON aninhado demais.");
                    return;
                }
                MarcarJson(escopo, bytes, o.MaxProfundidadeJson, chavesExtras);
            }
            else
            {
                await MarcarFormAsync(ctx, escopo, chavesExtras);
                req.Body.Position = 0;
            }
        }

        await next(ctx);
    }

    private static string? Tipo(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType)) return null;
        var i = contentType.IndexOf(';');
        return (i < 0 ? contentType : contentType[..i]).Trim().ToLowerInvariant();
    }

    private static bool EhJson(string tipo) => tipo == "application/json" || tipo.EndsWith("+json", StringComparison.Ordinal);

    private static HashSet<string>? ChavesDaRota(CyberOptions o, PathString caminho)
    {
        var p = caminho.Value?.TrimEnd('/');
        if (string.IsNullOrEmpty(p)) return null;
        foreach (var (rota, chaves) in o.ChavesPorRota)
            if (string.Equals(rota.TrimEnd('/'), p, StringComparison.OrdinalIgnoreCase))
                return chaves.Select(Chaves.Normalizar).ToHashSet();
        return null;
    }

    private static void Marcar(ITaintScope escopo, IEnumerable<AchadoPii> achados, OrigemDado origem)
    {
        foreach (var a in achados) escopo.Marcar(a.Valor, origem, a.Campo, a.Classe);
    }

    /// <summary>Lê no máximo <paramref name="limite"/> bytes; <c>null</c> se passar (conta o que de fato foi lido, não só o Content-Length).</summary>
    private static async Task<byte[]?> LerLimitadoAsync(Stream corpo, int limite, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        var buf = new byte[16 * 1024];
        int n;
        while ((n = await corpo.ReadAsync(buf, ct)) > 0)
        {
            if (ms.Length + n > limite) return null;
            ms.Write(buf, 0, n);
        }
        return ms.ToArray();
    }

    /// <summary>Maior nível de aninhamento de {} e [], ignorando o que está dentro de strings. Iterativo.</summary>
    private static int Profundidade(byte[] json)
    {
        int atual = 0, maximo = 0;
        var dentroString = false;
        for (var i = 0; i < json.Length; i++)
        {
            var b = json[i];
            if (dentroString)
            {
                if (b == (byte)'\\') i++;
                else if (b == (byte)'"') dentroString = false;
                continue;
            }
            switch (b)
            {
                case (byte)'"': dentroString = true; break;
                case (byte)'{' or (byte)'[': if (++atual > maximo) maximo = atual; break;
                case (byte)'}' or (byte)']': if (atual > 0) atual--; break;
            }
        }
        return maximo;
    }

    private void MarcarJson(ITaintScope escopo, byte[] bytes, int profundidade, HashSet<string>? chavesExtras)
    {
        try
        {
            using var doc = JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = profundidade });
            if (chavesExtras is not null) MarcarChavesExtras(escopo, doc.RootElement, chavesExtras);
            Marcar(escopo, scanner.EscanearJson(doc.RootElement), OrigemDado.Http);
        }
        catch (JsonException) { /* JSON inválido: segue sem marcar, o endpoint responde por conta própria */ }
    }

    // Campos que a rota declara como senha (ex.: "codigo" do login de emergência) valem como Senha mesmo sem padrão.
    private static void MarcarChavesExtras(ITaintScope escopo, JsonElement raiz, HashSet<string> chaves)
    {
        var pilha = new Stack<(JsonElement No, string Caminho)>();
        pilha.Push((raiz, ""));
        while (pilha.Count > 0)
        {
            var (no, caminho) = pilha.Pop();
            if (no.ValueKind == JsonValueKind.Object)
            {
                foreach (var p in no.EnumerateObject())
                {
                    var c = caminho.Length == 0 ? p.Name : caminho + "." + p.Name;
                    if (chaves.Contains(Chaves.Normalizar(p.Name)) && p.Value.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                    {
                        var v = p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() : p.Value.GetRawText();
                        if (v is not null) escopo.Marcar(v, OrigemDado.Http, c, PiiClasse.Senha);
                    }
                    else pilha.Push((p.Value, c));
                }
            }
            else if (no.ValueKind == JsonValueKind.Array)
                foreach (var item in no.EnumerateArray()) pilha.Push((item, caminho));
        }
    }

    private async Task MarcarFormAsync(HttpContext ctx, ITaintScope escopo, HashSet<string>? chavesExtras)
    {
        try
        {
            // Só campos de texto; form.Files não é lido aqui (arquivo não é varrido).
            var form = await ctx.Request.ReadFormAsync(ctx.RequestAborted);
            var pares = form.SelectMany(f => f.Value.Select(v => new KeyValuePair<string, string?>(f.Key, v)));
            Marcar(escopo, scanner.EscanearPares(pares, chavesExtras), OrigemDado.Form);
        }
        catch (Exception e) when (e is InvalidDataException or IOException or InvalidOperationException or BadHttpRequestException)
        {
            // form malformado: o endpoint decide o que fazer
        }
    }

    private static Task Problema(HttpContext ctx, int status, string codigo, string titulo)
    {
        var cid = ctx.Items[CorrelacaoMiddleware.ItemKey] as string ?? "";
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(
            new { type = "urn:ampara:erro:" + codigo, title = titulo, status, codigo, detalheCidadao = (string?)null, correlationId = cid },
            JsonProblema, "application/problem+json", ctx.RequestAborted);
    }
}
