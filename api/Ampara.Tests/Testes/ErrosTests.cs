using System.Text.Json;
using Ampara.Api.Middleware;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Ampara.Tests.Infra;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Tests;

public class ErrosTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static async Task<(DefaultHttpContext Ctx, JsonElement Json, string Corpo)> Tratar(Exception ex)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        ctx.Items["CorrelationId"] = "corr-teste";
        var h = new ProblemaHandler(NullLogger<ProblemaHandler>.Instance);
        Assert.True(await h.TryHandleAsync(ctx, ex, CancellationToken.None));
        ctx.Response.Body.Position = 0;
        var corpo = await new StreamReader(ctx.Response.Body).ReadToEndAsync();
        return (ctx, JsonDocument.Parse(corpo).RootElement.Clone(), corpo);
    }

    [Fact]
    public async Task Excecao_inesperada_vira_500_sem_vazar_valor()
    {
        var (ctx, json, corpo) = await Tratar(new Exception("cpf 123.456.789-09"));   // SINTETICO
        Assert.Equal(500, ctx.Response.StatusCode);
        Assert.DoesNotContain("123.456", corpo);
        Assert.Equal("erro-interno", json.GetProperty("codigo").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("detalheCidadao").ValueKind);
        Assert.Equal("corr-teste", json.GetProperty("correlationId").GetString());
        Assert.StartsWith("application/problem+json", ctx.Response.ContentType);
    }

    [Theory]
    [InlineData(typeof(DominioException), 422)]
    [InlineData(typeof(NaoEncontradoException), 404)]
    [InlineData(typeof(AcessoNegadoException), 403)]
    [InlineData(typeof(ConflitoException), 409)]
    [InlineData(typeof(RecursoVencidoException), 410)]
    [InlineData(typeof(NaoAutenticadoException), 401)]
    [InlineData(typeof(ServicoIndisponivelException), 502)]
    public async Task Excecao_mapeia_status(Type t, int status)
    {
        var ex = (Exception)Activator.CreateInstance(t, "x-codigo")!;
        var (ctx, json, _) = await Tratar(ex);
        Assert.Equal(status, ctx.Response.StatusCode);
        Assert.Equal("x-codigo", json.GetProperty("codigo").GetString());
        Assert.Equal(status, json.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task LimiteExcedido_vira_429_com_Retry_After_em_segundos()
    {
        var (ctx, json, _) = await Tratar(new LimiteExcedidoException("limite", TimeSpan.FromSeconds(90)));
        Assert.Equal(429, ctx.Response.StatusCode);
        Assert.Equal("90", ctx.Response.Headers["Retry-After"].ToString());
        Assert.Equal("limite", json.GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task Correlation_id_recebido_e_ecoado_e_ausente_e_gerado()
    {
        var c = f.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Get, "/openapi/v1.json");
        req.Headers.Add("X-Correlation-Id", "abc-1");
        var r1 = await c.SendAsync(req);
        Assert.Equal("abc-1", r1.Headers.GetValues("X-Correlation-Id").Single());

        var r2 = await c.GetAsync("/openapi/v1.json");
        Assert.True(Guid.TryParse(r2.Headers.GetValues("X-Correlation-Id").Single(), out _));
    }

    [Fact]
    public void Taint_noop_nao_altera_o_texto_e_nao_gera_evento()
    {
        var g = f.Services.GetRequiredService<ITaintGuard>();
        Assert.IsType<NoopTaintGuard>(g);
        Assert.False(g.Ativo);
        var t = "cpf 529.982.247-25";   // SINTETICO
        var r = g.Sanitizar(t, Sink.Log, new SanitizarOpcoes(OrigemDado.Http, "campo"));
        Assert.Same(t, r.Texto);
        Assert.False(r.Bloqueado);
        Assert.Empty(r.Eventos);
    }

    [Fact]
    public void Acesso_indevido_noop_nao_lanca()
    {
        var a = f.Services.GetRequiredService<IAcessoIndevido>();
        Assert.IsType<NoopAcessoIndevido>(a);
        a.Registrar(Guid.NewGuid(), "codigo-emergencia");
    }

    [Fact]
    public void Enums_do_contrato_serializam_como_combinado()
    {
        Assert.Equal("\"Cpf\"", JsonSerializer.Serialize(PiiClasse.Cpf));
        Assert.Equal("\"HttpAutenticada\"", JsonSerializer.Serialize(Sink.HttpAutenticada));
        Assert.Equal("\"Bloqueado\"", JsonSerializer.Serialize(Decisao.Bloqueado));
        Assert.Equal("\"mqtt\"", JsonSerializer.Serialize(OrigemDado.Mqtt));
        Assert.Equal("\"verde\"", JsonSerializer.Serialize(Farol.Verde));
    }

    [Fact]
    public void EventoSeguranca_Novo_preenche_os_campos_do_contrato_e_nao_tem_campo_de_valor()
    {
        var e = EventoSeguranca.Novo(DateTimeOffset.UtcNow, "abc-1", OrigemDado.Http, "documento", PiiClasse.Cpf, Sink.Log, Decisao.Bloqueado, null);
        Assert.Equal(("abc-1", "documento", PiiClasse.Cpf), (e.CorrelationId, e.Campo, e.Classe));
        Assert.Equal(new[] { "Campo", "Classe", "CorrelationId", "Decisao", "Em", "Id", "MensagemCidadao", "Sink", "Source", "UsuarioAlvoId" },
            typeof(EventoSeguranca).GetFields().Select(x => x.Name).OrderBy(n => n).ToArray());
    }
}
