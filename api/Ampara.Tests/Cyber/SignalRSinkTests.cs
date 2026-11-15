using System.Text;
using Ampara.Api.Cyber;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Protocol;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Ampara.Tests.Cyber;

public class SignalRSinkTests
{
    private static JsonHubProtocol Interno() => new();

    private static TaintHubProtocol Embrulho(out RastroEmMemoria rastro, bool taintAtivo = true)
    {
        rastro = new RastroEmMemoria();
        return new TaintHubProtocol(Interno(), new PiiScanner(DetectoresTests.TodosDetectores()), rastro,
            Options.Create(new CyberOptions { TaintAtivo = taintAtivo }));
    }

    private static string Texto(IHubProtocol p, HubMessage m) => Encoding.UTF8.GetString(p.GetMessageBytes(m).ToArray());

    [Fact] public void Alerta_do_contrato_sai_igual() {   // SINTETICO
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { alertaId = Guid.NewGuid(), ocorrenciaId = Guid.NewGuid(), vitimaNome = "Vitima Sintetica", origem = "chaveiro", em = DateTimeOffset.UtcNow } });
        Assert.Equal(Interno().GetMessageBytes(m).ToArray(), Embrulho(out var r).GetMessageBytes(m).ToArray()); Assert.Empty(r.Eventos); }

    [Fact] public void Mensagem_com_cpf_e_trocada_e_gera_evento() {   // SINTETICO
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { vitimaNome = "x", cpf = "529.982.247-25" } });
        var texto = Texto(Embrulho(out var r), m);
        Assert.DoesNotContain("529.982.247-25", texto); Assert.Contains("TaintBloqueado", texto);
        Assert.Equal((Sink.SignalR, Decisao.Bloqueado, PiiClasse.Cpf), (r.Eventos[0].Sink, r.Eventos[0].Decisao, r.Eventos[0].Classe)); }

    // Protocolo interno de mentira: devolve JSON com os digitos do CPF como escape unicode, como um serializador poderia emitir.
    private sealed class InternoComEscape : IHubProtocol {
        private readonly JsonHubProtocol _j = new();
        public string Name => _j.Name; public int Version => _j.Version; public TransferFormat TransferFormat => _j.TransferFormat;
        public bool IsVersionSupported(int v) => _j.IsVersionSupported(v);
        public bool TryParseMessage(ref System.Buffers.ReadOnlySequence<byte> i, IInvocationBinder b, out HubMessage? m) => _j.TryParseMessage(ref i, b, out m);
        public void WriteMessage(HubMessage m, System.Buffers.IBufferWriter<byte> o) => System.Buffers.BuffersExtensions.Write(o, GetMessageBytes(m).Span);
        public ReadOnlyMemory<byte> GetMessageBytes(HubMessage m) => m is InvocationMessage { Target: "AlertaDisparado" }
            ? Encoding.UTF8.GetBytes("{\"type\":1,\"target\":\"AlertaDisparado\",\"arguments\":[{\"nota\":\"\\u0035\\u0032\\u0039.982.247-25\"}]}")
            : _j.GetMessageBytes(m);
    }

    [Fact] public void Cpf_com_escape_unicode_no_json_e_decodificado_e_pego() {   // SINTETICO
        var rastro = new RastroEmMemoria();
        var p = new TaintHubProtocol(new InternoComEscape(), new PiiScanner(DetectoresTests.TodosDetectores()), rastro,
            Options.Create(new CyberOptions { TaintAtivo = true }));
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { nota = "qualquer" } });
        var bruto = Texto(new InternoComEscape(), m);
        Assert.Contains("\\u0035", bruto); Assert.DoesNotContain("529.982", bruto);   // em claro o scanner nao veria
        var texto = Texto(p, m);
        Assert.Contains("TaintBloqueado", texto); Assert.DoesNotContain("982.247", texto); Assert.DoesNotContain("u0035", texto);
        Assert.Equal(PiiClasse.Cpf, Assert.Single(rastro.Eventos).Classe); }

    private sealed class ScannerQueFalha : IPiiScanner {
        public IReadOnlyList<AchadoPii> EscanearJson(System.Text.Json.JsonElement raiz) => throw new InvalidOperationException();
        public IReadOnlyList<AchadoPii> EscanearPares(IEnumerable<KeyValuePair<string, string?>> pares, IReadOnlyCollection<string>? chavesExtras = null) => [];
        public IReadOnlyList<AchadoPii> EscanearTexto(string texto, string campo = "texto") => [];
        public IReadOnlyList<Deteccao> Localizar(string textoNormalizado) => [];
    }

    [Fact] public void Falha_ao_inspecionar_fecha_e_nada_do_original_sai() {   // SINTETICO
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { nota = "conteudo-original" } });
        var p = new TaintHubProtocol(Interno(), new ScannerQueFalha(), new RastroEmMemoria(), Options.Create(new CyberOptions { TaintAtivo = true }));
        var texto = Texto(p, m);
        Assert.Contains("TaintBloqueado", texto); Assert.DoesNotContain("conteudo-original", texto); }

    [Fact] public void Completion_suja_vira_erro_e_ping_passa_direto() {   // SINTETICO
        var e = Embrulho(out var r);
        var texto = Texto(e, CompletionMessage.WithResult("1", new { cpf = "529.982.247-25" }));
        Assert.DoesNotContain("529.982.247-25", texto); Assert.Contains("TaintBloqueado", texto); Assert.Contains("\"error\"", texto);
        Assert.Single(r.Eventos);
        Assert.Equal(Interno().GetMessageBytes(PingMessage.Instance).ToArray(), e.GetMessageBytes(PingMessage.Instance).ToArray()); }

    [Fact] public void Container_resolve_o_embrulho_como_unico_protocolo_registrado() {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["AMPARA_CRYPTO_KEY"] = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray()) }).Build();
        var s = new ServiceCollection();
        s.AddSingleton<IConfiguration>(config);
        s.AddLogging();
        s.AddSignalR();
        s.AddCyber(config);
        s.AddSingleton<IRastroSeguranca>(new RastroEmMemoria());
        using var sp = s.BuildServiceProvider();
        Assert.IsType<TaintHubProtocol>(Assert.Single(sp.GetServices<IHubProtocol>())); }

    [Fact] public void WriteMessage_tambem_protege_e_sem_separador_duplicado() {   // SINTETICO
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { cpf = "529.982.247-25" } });
        var buf = new System.Buffers.ArrayBufferWriter<byte>();
        Embrulho(out var r).WriteMessage(m, buf);
        var texto = Encoding.UTF8.GetString(buf.WrittenSpan);
        Assert.DoesNotContain("529.982.247-25", texto); Assert.Contains("TaintBloqueado", texto);
        Assert.Equal(0x1E, buf.WrittenSpan[^1]); Assert.Single(r.Eventos); }

    [Fact] public void Taint_desligado_na_demonstracao_deixa_passar() {   // SINTETICO
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { cpf = "529.982.247-25" } });
        var o = new TaintHubProtocol(Interno(), new PiiScanner(DetectoresTests.TodosDetectores()), new RastroEmMemoria(),
            Options.Create(new CyberOptions { Demo = true, TaintAtivo = false }));
        Assert.Contains("529.982.247-25", Texto(o, m)); }

    [Fact] public void Delega_metadados_ao_protocolo_interno() {
        var e = Embrulho(out _); var i = Interno();
        Assert.Equal((i.Name, i.Version, i.TransferFormat), (e.Name, e.Version, e.TransferFormat));
        Assert.Equal(i.IsVersionSupported(1), e.IsVersionSupported(1)); }
}
