using System.Text;
using Ampara.Api.Cyber;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Protocol;
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

    [Fact] public void Cpf_escrito_com_escape_unicode_tambem_e_pego() {   // SINTETICO
        var m = new InvocationMessage("AlertaDisparado", new object[]{ new { nota = "\u0035\u0032\u0039.982.247-25" } });
        var texto = Texto(Embrulho(out var r), m);
        Assert.Contains("TaintBloqueado", texto); Assert.DoesNotContain("982.247", texto);
        Assert.Equal(PiiClasse.Cpf, Assert.Single(r.Eventos).Classe); }

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
