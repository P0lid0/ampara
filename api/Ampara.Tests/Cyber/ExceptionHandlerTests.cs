using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Api.Middleware;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ampara.Tests.Cyber;

public class ExceptionHandlerTests
{
    private sealed class TradutorFalso : ITradutorRisco
    {
        public const string Frase = "Frase do falso para o erro. Segunda frase do falso.";
        public EventoTecnico? Ultimo { get; private set; }
        public Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default) { Ultimo = evento; return Task.FromResult(Frase); }
    }

    private sealed class TradutorQueLanca : ITradutorRisco
    {
        public Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default) => throw new InvalidOperationException("falhou 529.982.247-25");
    }

    private static void Mapa(IEndpointRouteBuilder m)
    {
        // SINTETICO
        m.MapGet("/explode", (Func<string>)(() => throw new InvalidOperationException("falha ao salvar laudo do paciente: diagnóstico F32 para 529.982.247-25")));
        m.MapGet("/timeout", (Func<string>)(() => throw new TimeoutException("db")));
        m.MapGet("/nao-existe-recurso", (Func<string>)(() => throw new NaoEncontradoException("x-codigo")));
    }

    private static async Task<(HttpResponseMessage R, string Corpo, CyberTestHost H)> Get(string rota, ITradutorRisco tradutor)
    {
        var h = await CyberTestHost.IniciarAsync(Mapa, s =>
        {
            s.RemoveAll<ITradutorRisco>();
            s.AddSingleton(tradutor);
            s.AddExceptionHandler<ProblemaHandler>();   // como no Program.cs: depois do AddCyber
        });
        var r = await h.GetTestClient().GetAsync(rota);
        return (r, await r.Content.ReadAsStringAsync(), h);
    }

    [Fact] public async Task Excecao_com_pii_vira_frase_humana_e_nao_vaza()
    {
        var (r, t, h) = await Get("/explode", new TradutorFalso());
        await using var _ = h;
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType!.MediaType);
        Assert.All(new[] { "529.982.247-25", "diagnóstico", "laudo do paciente", "InvalidOperation", "Error 500", "at Ampara" }, s => Assert.DoesNotContain(s, t));
        var raiz = JsonDocument.Parse(t).RootElement;
        Assert.Equal(TradutorFalso.Frase, raiz.GetProperty("detalheCidadao").GetString());
        Assert.Equal("urn:ampara:erro", raiz.GetProperty("type").GetString());
        Assert.Equal("Não foi possível concluir a ação", raiz.GetProperty("title").GetString());
        Assert.Equal(500, raiz.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrEmpty(raiz.GetProperty("correlationId").GetString()));
        Assert.Contains(h.Rastro.Eventos, e => e.Classe == PiiClasse.Cpf && e.Sink == Sink.Erro && e.Decisao == Decisao.Bloqueado);
        Assert.Contains(h.Rastro.Eventos, e => e.Classe == PiiClasse.Saude && e.Sink == Sink.Erro);
    }

    [Fact] public async Task Excecao_sem_pii_chama_tradutor_como_falha_do_sistema_sem_evento()
    {
        var tradutor = new TradutorFalso();
        var (r, _, h) = await Get("/timeout", tradutor);
        await using var _ = h;
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Empty(h.Rastro.Eventos);
        Assert.Equal(new EventoTecnico("FalhaSistema", "Erro", "TimeoutException"), tradutor.Ultimo);
    }

    [Fact] public async Task Excecao_com_pii_chama_tradutor_com_a_classe_achada()
    {
        var tradutor = new TradutorFalso();
        var (_, _, h) = await Get("/explode", tradutor);
        await using var _ = h;
        Assert.Equal("Erro", tradutor.Ultimo!.Sink);
        Assert.Equal("Bloqueado", tradutor.Ultimo.Tipo);
        Assert.NotEqual("FalhaSistema", tradutor.Ultimo.Categoria);
        Assert.DoesNotContain("529.982.247-25", tradutor.Ultimo.ToString());
    }

    [Fact] public async Task Tradutor_que_estoura_ainda_responde_500_amigavel()
    {
        var (r, t, h) = await Get("/explode", new TradutorQueLanca());
        await using var _ = h;
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType!.MediaType);
        Assert.Equal(FrasesPadrao.FalhaSistema, JsonDocument.Parse(t).RootElement.GetProperty("detalheCidadao").GetString());
        Assert.DoesNotContain("Error 500", t);
        Assert.DoesNotContain("529.982.247-25", t);
    }

    [Fact] public async Task Excecao_de_dominio_continua_com_o_status_do_plano_02_e_ganha_frase_humana()
    {
        var tradutor = new TradutorFalso();
        var (r, t, h) = await Get("/nao-existe-recurso", tradutor);
        await using var _ = h;
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType!.MediaType);
        var raiz = JsonDocument.Parse(t).RootElement;
        Assert.Equal("x-codigo", raiz.GetProperty("codigo").GetString());
        Assert.Equal(TradutorFalso.Frase, raiz.GetProperty("detalheCidadao").GetString());
        Assert.Equal(EventoTecnico.Recusa("x-codigo"), tradutor.Ultimo);   // recusa de regra, não "FalhaSistema"
        Assert.Empty(h.Rastro.Eventos);
    }

    [Fact] public async Task Excecao_de_dominio_com_tradutor_que_estoura_ainda_responde()
    {
        var (r, t, h) = await Get("/nao-existe-recurso", new TradutorQueLanca());
        await using var _ = h;
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal(FrasesPadrao.RecusaPadrao, JsonDocument.Parse(t).RootElement.GetProperty("detalheCidadao").GetString());
    }

    [Fact] public void Acesso_indevido_registra_evento_para_o_dono()
    {
        var rastro = new RastroEmMemoria();
        var dono = Guid.NewGuid();
        var a = new AcessoIndevido(rastro, new CorrelacaoFixa("corr-1"));
        a.Registrar(dono, IndiceRisco.CampoCodigoEmergencia);
        var e = Assert.Single(rastro.Eventos);
        Assert.Equal(dono, e.UsuarioAlvoId);
        Assert.Equal(40, IndiceRisco.Peso(e));
        Assert.Equal((OrigemDado.Http, PiiClasse.Senha, Sink.HttpNaoAutenticada, Decisao.Bloqueado), (e.Source, e.Classe, e.Sink, e.Decisao));
        Assert.Equal("corr-1", e.CorrelationId);
    }

    [Fact] public void Acesso_indevido_a_recurso_de_outro_usuario_pesa_40_e_prefere_o_correlation_id_explicito()
    {
        var rastro = new RastroEmMemoria();
        var a = new AcessoIndevido(rastro, new CorrelacaoFixa("corr-1"));
        a.Registrar(Guid.NewGuid(), IndiceRisco.CampoRecursoOutroUsuario, "corr-2");
        var e = Assert.Single(rastro.Eventos);
        Assert.Equal(40, IndiceRisco.Peso(e));
        Assert.Equal("corr-2", e.CorrelationId);
    }

    [Fact] public void Acesso_indevido_nunca_lanca_mesmo_com_rastro_quebrado()
    {
        var a = new AcessoIndevido(new RastroQueLanca());
        a.Registrar(Guid.NewGuid(), IndiceRisco.CampoCodigoEmergencia);
    }

    [Fact] public async Task AddCyber_troca_o_noop_pelo_acesso_indevido_real()
    {
        await using var h = await CyberTestHost.IniciarAsync(_ => { });
        Assert.IsType<AcessoIndevido>(h.Services.GetRequiredService<IAcessoIndevido>());
    }

    [Fact]
    public async Task Codigo_de_emergencia_errado_gera_acesso_indevido_para_a_vitima()
    {
        await using var f = new CyberApiFactory();
        var v = await CyberTestHelpers.CriarVitimaComOcorrenciaAsync(f.CreateClient());
        var anonimo = f.CreateClient();
        var r = await anonimo.PostAsJsonAsync("/api/v1/auth/emergencia", new { email = v.Email, codigo = "000000", palavraSecreta = "palavra-errada" });   // SINTETICO
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);

        var e = Assert.Single((await f.EventosNoBancoAsync(v.UsuarioId)).Where(IndiceRisco.EhAcessoIndevido));
        Assert.Equal(IndiceRisco.CampoCodigoEmergencia, e.Campo);
        Assert.Equal(40, IndiceRisco.Peso(e));
        Assert.Equal(v.UsuarioId, e.UsuarioAlvoId);
    }

    private sealed class CorrelacaoFixa(string id) : ICorrelacao { public string Id { get; } = id; }
    private sealed class RastroQueLanca : IRastroSeguranca { public void Registrar(EventoSeguranca e) => throw new InvalidOperationException("x"); }
}
