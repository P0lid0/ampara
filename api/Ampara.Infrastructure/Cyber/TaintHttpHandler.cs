using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Sinks Ponte e Claude API: todo HttpClient passa por aqui. O sink sai do host do pedido (PONTE_URL = Ponte;
/// api.anthropic.com = Llm); qualquer outro host passa direto. Achado de PII bloqueia o pedido ANTES de enviar.
/// </summary>
public sealed class TaintHttpHandler(ITaintGuard guardPadrao, IConfiguration config, IHttpContextAccessor? http = null) : DelegatingHandler
{
    public const string HostLlm = "api.anthropic.com";

    private readonly string _hostPonte = HostDe(config["PONTE_URL"]);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var sink = SinkDoHost(request.RequestUri);
        if (sink is not null) await VerificarAsync(request, sink.Value, ct);
        return await base.SendAsync(request, ct);
    }

    private Sink? SinkDoHost(Uri? uri)
    {
        if (uri is null || !uri.IsAbsoluteUri) return null;
        if (uri.Host.Equals(HostLlm, StringComparison.OrdinalIgnoreCase)) return Sink.Llm;
        if (_hostPonte.Length > 0 && uri.Host.Equals(_hostPonte, StringComparison.OrdinalIgnoreCase)) return Sink.Ponte;
        return null;
    }

    private async Task VerificarAsync(HttpRequestMessage request, Sink sink, CancellationToken ct)
    {
        // Preferimos o guard da requisição em andamento (traz os valores vistos na entrada); sem ela, o do handler.
        var guard = http?.HttpContext?.RequestServices.GetService<ITaintGuard>() ?? guardPadrao;
        var textos = new List<string>(2);
        var consulta = request.RequestUri!.Query;
        if (consulta.Length > 1) textos.Add(Uri.UnescapeDataString(consulta));
        if (request.Content is { } c && EhTexto(c.Headers.ContentType?.MediaType))
        {
            await c.LoadIntoBufferAsync(ct);   // mantém o conteúdo legível para o envio
            textos.Add(await c.ReadAsStringAsync(ct));
        }
        foreach (var t in textos)
        {
            var r = guard.Sanitizar(t, sink, new SanitizarOpcoes(Campo: "corpo"));
            if (r.Bloqueado) throw new TaintBloqueadoException(sink, r.Eventos.Count > 0 ? r.Eventos[0].Classe : default);
        }
    }

    private static bool EhTexto(string? tipo) =>
        tipo is null || tipo.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
        || tipo.Contains("json", StringComparison.OrdinalIgnoreCase) || tipo.Contains("xml", StringComparison.OrdinalIgnoreCase)
        || tipo.Equals("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase);

    private static string HostDe(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) url = "http://localhost:8000";   // mesmo padrão do PontePoliciaClient
        return Uri.TryCreate(url, UriKind.Absolute, out var u) ? u.Host : "";
    }
}
