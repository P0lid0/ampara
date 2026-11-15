using System.Text;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Options;

namespace Ampara.Api.Cyber;

/// <summary>
/// Sink <see cref="Sink.HttpNaoAutenticada"/>: toda resposta de texto/JSON para quem não está autenticado passa
/// pelo guard antes de sair. Achado fora de <see cref="PiiPermitidaAttribute"/> troca a resposta por um
/// <c>application/problem+json</c> sem o dado. Resposta enorme é bloqueada (fail-closed). Binário, SSE, /hubs e
/// resposta autenticada passam direto, sem buffer: a decisão sai na primeira escrita, quando o usuário já é conhecido.
/// </summary>
public sealed class RespostaNaoAutenticadaMiddleware(RequestDelegate next, IPiiScanner scanner, IOptions<CyberOptions> opcoes)
{
    private static readonly JsonSerializerOptions JsonProblema = new(JsonSerializerDefaults.Web);
    private const int FatorLimite = 4;
    private static readonly string[] CabecalhosDoCorpo =
        ["Content-Type", "Content-Length", "Content-Encoding", "Content-Disposition", "Content-Language", "Content-Range", "ETag", "Last-Modified", "Set-Cookie"];

    public async Task InvokeAsync(HttpContext ctx, ITaintGuard guard, ITaintScope escopo, ITradutorRisco tradutor,
        IRastroSeguranca rastro, ICorrelacao correlacao)
    {
        if (!guard.Ativo || ctx.Request.Path.StartsWithSegments("/hubs")) { await next(ctx); return; }

        var original = ctx.Response.Body;
        var limite = (long)opcoes.Value.LimiteCorpoBytes * FatorLimite;
        var fluxo = new FluxoDecisor(original, ctx, limite);
        ctx.Response.Body = fluxo;
        try
        {
            await next(ctx);
            if (!fluxo.Bufferizando) return;   // já passou direto (ou nada foi escrito)
            await AvaliarAsync(ctx, original, fluxo, guard, escopo, tradutor, rastro, correlacao);
        }
        finally { ctx.Response.Body = original; }
    }

    private async Task AvaliarAsync(HttpContext ctx, Stream original, FluxoDecisor fluxo, ITaintGuard guard,
        ITaintScope escopo, ITradutorRisco tradutor, IRastroSeguranca rastro, ICorrelacao correlacao)
    {
        var cid = correlacao.Id;
        var permitidas = ctx.GetEndpoint()?.Metadata.GetOrderedMetadata<PiiPermitidaAttribute>()
            .SelectMany(a => a.Classes).ToHashSet() ?? [];

        if (fluxo.Estourou) { await BloquearAsync(ctx, original, tradutor, EventoSintetico(cid), cid); return; }

        var texto = Encoding.UTF8.GetString(fluxo.Buffer.GetBuffer(), 0, (int)fluxo.Buffer.Length);
        var norm = Normalizador.Normalizar(texto);

        // 1) o que fica de fora do guard: valores das classes que o endpoint permite por contrato
        JsonElement raiz = default;
        var json = EhJson(ctx.Response.ContentType) && TentaJson(texto, out raiz);
        var achados = json ? scanner.EscanearJson(raiz) : scanner.EscanearTexto(norm);
        var mascarado = norm;
        // JSON com escapes unicode esconde o valor do texto cru: o cliente decodifica, entao o guard tambem olha os valores decodificados.
        var decodificado = json && texto.Contains('\\') ? Normalizador.Normalizar(ValoresDecodificados(raiz)) : null;
        var permitidosVistos = new Dictionary<(PiiClasse, string), string>();
        if (permitidas.Count > 0)
        {
            foreach (var d in scanner.Localizar(norm).Where(d => permitidas.Contains(d.Classe)))
            {
                var fim = Math.Min(norm.Length, d.Inicio + d.Tamanho);
                if (fim <= d.Inicio) continue;
                permitidosVistos.TryAdd((d.Classe, norm.Substring(d.Inicio, fim - d.Inicio)), "resposta");
            }
            foreach (var a in achados.Where(a => permitidas.Contains(a.Classe))) permitidosVistos.TryAdd((a.Classe, a.Valor), a.Campo);
            foreach (var valor in permitidosVistos.Keys.Select(k => k.Item2).OrderByDescending(v => v.Length))
                if (valor.Length > 0)
                {
                    mascarado = mascarado.Replace(valor, new string('_', valor.Length), StringComparison.Ordinal);
                    decodificado = decodificado?.Replace(valor, new string('_', valor.Length), StringComparison.Ordinal);
                }
        }

        // 2) o resto: achados por chave (ex.: "senha") entram no escopo para o guard reconhecê-los
        foreach (var a in achados.Where(a => !permitidas.Contains(a.Classe) && a.Valor.Length >= 4))
            escopo.Marcar(a.Valor, OrigemDado.Http, a.Campo, a.Classe);

        if (decodificado is not null) mascarado += "\n" + decodificado;
        var r = guard.Sanitizar(mascarado, Sink.HttpNaoAutenticada, new SanitizarOpcoes(OrigemDado.Http, "resposta", null, cid));
        if (r.Bloqueado)
        {
            await BloquearAsync(ctx, original, tradutor, r.Eventos.First(e => e.Decisao == Decisao.Bloqueado), cid);
            return;
        }

        foreach (var ((classe, _), campo) in permitidosVistos)
        {
            try { rastro.Registrar(EventoSeguranca.Novo(TimeProvider.System.GetUtcNow(), cid, OrigemDado.Http, campo, classe, Sink.HttpNaoAutenticada, Decisao.Permitido, null)); }
            catch { /* o rastro nunca altera a resposta */ }
        }
        fluxo.Buffer.Position = 0;
        await fluxo.Buffer.CopyToAsync(original, ctx.RequestAborted);
    }

    private async Task BloquearAsync(HttpContext ctx, Stream original, ITradutorRisco tradutor, EventoSeguranca evento, string cid)
    {
        var frase = await tradutor.TraduzirAsync(EventoTecnico.De(evento), ctx.RequestAborted);
        var status = ctx.Response.StatusCode is >= 400 and < 500 ? ctx.Response.StatusCode : StatusCodes.Status500InternalServerError;
        var corpo = JsonSerializer.SerializeToUtf8Bytes(new
        {
            type = "urn:ampara:taint:bloqueado", title = "Resposta bloqueada para proteger seus dados",
            status, correlationId = cid, detalheCidadao = frase,
        }, JsonProblema);
        // Não usar Response.Clear(): apagaria cabeçalhos de CORS/segurança gravados por middlewares anteriores.
        // Remove só o que descreve o corpo antigo ou pode carregar dado da resposta original.
        foreach (var h in CabecalhosDoCorpo) ctx.Response.Headers.Remove(h);
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";
        ctx.Response.ContentLength = corpo.Length;
        await original.WriteAsync(corpo, ctx.RequestAborted);
    }

    /// <summary>Corpo grande demais para varrer: sem classe real, o evento vai como Senha/Bloqueado só para o tradutor.</summary>
    private static EventoSeguranca EventoSintetico(string cid) =>
        EventoSeguranca.Novo(TimeProvider.System.GetUtcNow(), cid, OrigemDado.Http, "resposta", PiiClasse.Senha, Sink.HttpNaoAutenticada, Decisao.Bloqueado, null);

    private static bool EhJson(string? ct) => ct is not null && ct.Contains("json", StringComparison.OrdinalIgnoreCase);

    /// <summary>Nomes de propriedade e valores de texto do JSON ja decodificados, um por linha.</summary>
    private static string ValoresDecodificados(JsonElement raiz)
    {
        var sb = new StringBuilder();
        void Visitar(JsonElement e)
        {
            switch (e.ValueKind)
            {
                case JsonValueKind.String: sb.Append(e.GetString()).Append('\n'); break;
                case JsonValueKind.Array: foreach (var i in e.EnumerateArray()) Visitar(i); break;
                case JsonValueKind.Object:
                    foreach (var p in e.EnumerateObject()) { sb.Append(p.Name).Append('\n'); Visitar(p.Value); }
                    break;
            }
        }
        Visitar(raiz);
        return sb.ToString();
    }

    private static bool TentaJson(string texto, out JsonElement raiz)
    {
        try { using var d = JsonDocument.Parse(texto, new JsonDocumentOptions { MaxDepth = 64 }); raiz = d.RootElement.Clone(); return true; }
        catch (JsonException) { raiz = default; return false; }
    }

    /// <summary>Decide na primeira escrita: usuário autenticado ou conteúdo não textual passam direto; o resto vai para memória.</summary>
    private sealed class FluxoDecisor(Stream destino, HttpContext ctx, long limite) : Stream
    {
        private bool? _bufferizar;
        public MemoryStream Buffer { get; } = new();
        public bool Estourou { get; private set; }
        public bool Bufferizando => _bufferizar == true;

        private bool Decidir()
        {
            if (_bufferizar is { } d) return d;
            var autenticado = ctx.User?.Identity?.IsAuthenticated == true;
            var tipo = ctx.Response.ContentType?.Split(';')[0].Trim().ToLowerInvariant();
            // Sem Content-Type declarado a resposta é tratada como texto: fail-closed.
            var textual = string.IsNullOrEmpty(tipo)
                || (tipo != "text/event-stream" && (tipo.StartsWith("text/") || tipo.Contains("json") || tipo.Contains("xml") || tipo.Contains("javascript")));
            _bufferizar = !autenticado && textual;
            return _bufferizar.Value;
        }

        public override void Write(byte[] buffer, int offset, int count) => Write(buffer.AsSpan(offset, count));

        public override void Write(ReadOnlySpan<byte> buffer)
        {
            if (!Decidir()) { destino.Write(buffer); return; }
            Acumular(buffer);
        }

        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken ct) =>
            WriteAsync(buffer.AsMemory(offset, count), ct).AsTask();

        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken ct = default)
        {
            if (!Decidir()) return destino.WriteAsync(buffer, ct);
            Acumular(buffer.Span);
            return ValueTask.CompletedTask;
        }

        private void Acumular(ReadOnlySpan<byte> b)
        {
            if (Estourou) return;
            if (Buffer.Length + b.Length > limite) { Estourou = true; Buffer.SetLength(0); return; }
            Buffer.Write(b);
        }

        public override void Flush() { if (_bufferizar == false) destino.Flush(); }
        public override Task FlushAsync(CancellationToken ct) => _bufferizar == false ? destino.FlushAsync(ct) : Task.CompletedTask;

        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
    }
}
