using System.Buffers;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Protocol;
using Microsoft.Extensions.Options;

namespace Ampara.Api.Cyber;

/// <summary>
/// Sink SignalR: embrulha o protocolo JSON do hub. Toda mensagem que vai para o cliente é serializada pelo protocolo
/// interno, decodificada (os escapes <c>\uXXXX</c> viram texto) e varrida pelo scanner. Com achado, grava o evento
/// <c>SignalR/Bloqueado</c> (sem o valor) e envia no lugar uma invocação <c>TaintBloqueado</c> sem argumentos.
/// Mensagem limpa sai byte a byte igual à do protocolo interno. Singleton: depende só de serviços singleton.
/// </summary>
public sealed class TaintHubProtocol(
    IHubProtocol interno, IPiiScanner scanner, IRastroSeguranca rastro, IOptions<CyberOptions> opcoes, ICorrelacao? correlacao = null, TimeProvider? relogio = null) : IHubProtocol
{
    public const string AlvoBloqueado = "TaintBloqueado";
    private const byte SeparadorDeRegistro = 0x1E;

    public string Name => interno.Name;
    public int Version => interno.Version;
    public TransferFormat TransferFormat => interno.TransferFormat;
    public bool IsVersionSupported(int version) => interno.IsVersionSupported(version);

    public bool TryParseMessage(ref ReadOnlySequence<byte> input, IInvocationBinder binder, out HubMessage? message)
        => interno.TryParseMessage(ref input, binder, out message);

    public void WriteMessage(HubMessage message, IBufferWriter<byte> output) => output.Write(GetMessageBytes(message).Span);

    public ReadOnlyMemory<byte> GetMessageBytes(HubMessage message)
    {
        var bytes = interno.GetMessageBytes(message);
        if (!opcoes.Value.Efetivo || message is not (InvocationMessage or StreamItemMessage or CompletionMessage))
            return bytes;
        try
        {
            if (!ContemPii(bytes)) return bytes;
        }
        catch (Exception)
        {
            // Não deu para inspecionar: fecha. Nada do conteúdo original sai.
        }
        return interno.GetMessageBytes(Substituta(message));
    }

    private bool ContemPii(ReadOnlyMemory<byte> bytes)
    {
        var span = bytes.Span;
        if (span.Length > 0 && span[^1] == SeparadorDeRegistro) span = span[..^1];
        using var doc = JsonDocument.Parse(span.ToArray());
        var achou = false;
        var corr = correlacao?.Id ?? "";
        var vistos = new HashSet<(string, PiiClasse)>();
        foreach (var chave in new[] { "arguments", "item", "result" })   // só o conteúdo; target e invocationId são do protocolo
        {
            if (!doc.RootElement.TryGetProperty(chave, out var conteudo)) continue;
            foreach (var a in scanner.EscanearJson(conteudo))
            {
                achou = true;
                if (!vistos.Add((a.Campo, a.Classe))) continue;
                try
                {
                    rastro.Registrar(EventoSeguranca.Novo((relogio ?? TimeProvider.System).GetUtcNow(), corr, OrigemDado.Http,
                        string.IsNullOrEmpty(a.Campo) ? chave : chave + a.Campo, a.Classe, Sink.SignalR, Decisao.Bloqueado, null));
                }
                catch { /* falha do rastro nunca altera o resultado */ }
            }
        }
        return achou;
    }

    // Uma resposta (Completion) trocada por invocação deixaria o chamador esperando: vira erro, sem o conteúdo.
    private static HubMessage Substituta(HubMessage original) => original is CompletionMessage c
        ? CompletionMessage.WithError(c.InvocationId!, AlvoBloqueado)
        : new InvocationMessage(AlvoBloqueado, []);
}
