using System.Security.Claims;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Ampara.Tests.Cyber;

public class TaintGuardTests
{
    private static readonly string Chave = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO

    private sealed class RastroQueLanca : IRastroSeguranca { public void Registrar(EventoSeguranca e) => throw new InvalidOperationException("rastro fora do ar"); }

    private static TaintGuard Montar(IRastroSeguranca rastro, Action<ITaintScope>? marcar = null, bool taintAtivo = true, bool demo = false,
        IHttpContextAccessor? http = null, ICorrelacao? corr = null, ITaintScope? escopo = null)
    {
        escopo ??= new TaintScope();
        marcar?.Invoke(escopo);
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build();
        return new TaintGuard(new PiiScanner(DetectoresTests.TodosDetectores()), escopo, new PiiProtetor(cfg), rastro,
            Options.Create(new CyberOptions { TaintAtivo = taintAtivo, Demo = demo }), http, corr);
    }

    private static TaintGuard Guard(out RastroEmMemoria rastro, Action<ITaintScope>? marcar = null)
    {
        rastro = new RastroEmMemoria();
        return Montar(rastro, marcar);
    }

    private static TaintGuard GuardCom(bool taintAtivo, bool demo) => Montar(new RastroEmMemoria(), null, taintAtivo, demo);

    [Fact] public void Log_bloqueia_cpf_e_grava_rastro_sem_valor() {   // SINTETICO
        var g = Guard(out var rastro);
        var r = g.Sanitizar("cadastro do cpf 529.982.247-25 ok", Sink.Log);
        Assert.True(r.Bloqueado); Assert.DoesNotContain("529.982.247-25", r.Texto); Assert.Contains("[BLOQUEADO:Cpf]", r.Texto);
        var e = Assert.Single(rastro.Eventos); Assert.Equal((Sink.Log, Decisao.Bloqueado, PiiClasse.Cpf), (e.Sink, e.Decisao, e.Classe));
        Assert.Same(e, Assert.Single(r.Eventos));
        Assert.DoesNotContain("529982247", JsonSerializer.Serialize(e).Replace(".", "").Replace("-", "")); }

    [Fact] public void Valor_marcado_sem_padrao_tambem_e_bloqueado() {
        var g = Guard(out var rastro, escopo => escopo.Marcar("Zq9!xKp2", OrigemDado.Form, "senha", PiiClasse.Senha));
        var r = g.Sanitizar("falha com Zq9!xKp2", Sink.Erro);
        Assert.DoesNotContain("Zq9!xKp2", r.Texto); Assert.Equal("falha com [BLOQUEADO:Senha]", r.Texto);
        Assert.Equal(("senha", OrigemDado.Form, PiiClasse.Senha), (rastro.Eventos[0].Campo, rastro.Eventos[0].Source, rastro.Eventos[0].Classe)); }

    [Fact] public void Banco_mascara_cpf_e_cifra_imei() {   // SINTETICO
        Assert.Contains("***.982.***-25", Guard(out _).Sanitizar("529.982.247-25", Sink.Banco).Texto);
        var g = Guard(out var rastro);
        var r = g.Sanitizar("490154203237518", Sink.Banco);
        Assert.StartsWith("enc:v1:", r.Texto); Assert.DoesNotContain("490154203237518", r.Texto);
        Assert.False(r.Bloqueado); Assert.Equal(Decisao.Cifrado, rastro.Eventos[0].Decisao); }

    [Fact] public void Sem_pii_devolve_a_mesma_string_sem_eventos() { var t = "ola mundo"; var g = Guard(out var r); Assert.Same(t, g.Sanitizar(t, Sink.Log).Texto); Assert.Empty(r.Eventos); }

    [Fact] public void Valor_repetido_gera_um_evento_e_dois_valores_geram_dois() {   // SINTETICO
        var g = Guard(out var rastro);
        var r = g.Sanitizar("529.982.247-25 e 529.982.247-25 e 529.982.247-25", Sink.Log);
        Assert.Single(r.Eventos); Assert.DoesNotContain("529.982.247-25", r.Texto);
        Assert.Equal(3, r.Texto.Split("[BLOQUEADO:Cpf]").Length - 1);
        var r2 = g.Sanitizar("529.982.247-25 529.982.247-25 123.456.789-09", Sink.Log);
        Assert.Equal(2, r2.Eventos.Count); Assert.Equal(3, rastro.Eventos.Count); }

    [Fact] public void HttpAutenticada_nao_bloqueia_e_o_guard_real_substitui_o_noop() {   // SINTETICO
        var r = Guard(out var rastro).Sanitizar("cpf 529.982.247-25", Sink.HttpAutenticada);
        Assert.False(r.Bloqueado); Assert.Equal("cpf 529.982.247-25", r.Texto); Assert.Empty(rastro.Eventos);
        using var s = Provedor().CreateScope();
        Assert.IsType<TaintGuard>(s.ServiceProvider.GetRequiredService<ITaintGuard>()); Assert.True(s.ServiceProvider.GetRequiredService<ITaintGuard>().Ativo); }

    [Fact] public void Falha_do_rastro_nao_libera_nem_derruba() {   // SINTETICO
        var r = Montar(new RastroQueLanca()).Sanitizar("cpf 529.982.247-25", Sink.Log);
        Assert.DoesNotContain("529.982.247-25", r.Texto); Assert.True(r.Bloqueado); }

    [Fact] public void Flag_so_vale_em_demonstracao() {   // SINTETICO
        Assert.Contains("529.982.247-25", GuardCom(taintAtivo: false, demo: true).Sanitizar("529.982.247-25", Sink.Log).Texto);
        Assert.DoesNotContain("529.982.247-25", GuardCom(taintAtivo: false, demo: false).Sanitizar("529.982.247-25", Sink.Log).Texto); }

    [Fact] public void Flag_desligada_nao_grava_nada_e_a_configuracao_do_host_respeita_a_demonstracao() {   // SINTETICO
        var rastro = new RastroEmMemoria();
        var g = Montar(rastro, taintAtivo: false, demo: true);
        var t = "529.982.247-25"; var r = g.Sanitizar(t, Sink.Log);
        Assert.Same(t, r.Texto); Assert.Empty(r.Eventos); Assert.Empty(rastro.Eventos); Assert.False(g.Ativo);
        using var s = Provedor(("Cyber:TaintAtivo", "false"), ("AMPARA_DEMO", "true")).CreateScope();
        Assert.False(s.ServiceProvider.GetRequiredService<ITaintGuard>().Ativo);
        using var p = Provedor(("Cyber:TaintAtivo", "false")).CreateScope();   // sem demo a flag e ignorada
        Assert.True(p.ServiceProvider.GetRequiredService<ITaintGuard>().Ativo); }

    [Fact] public void Alvo_e_correlacao_vem_das_opcoes_do_escopo_ou_do_usuario_logado() {   // SINTETICO
        var id = Guid.NewGuid();
        var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString())], "t")) } };
        var rastro = new RastroEmMemoria();
        var g = Montar(rastro, http: http);
        Assert.Equal(id, g.Sanitizar("529.982.247-25", Sink.Log, new SanitizarOpcoes(OrigemDado.Query, "cpf", null, "abc-1")).Eventos.Single().UsuarioAlvoId);
        var e = rastro.Eventos.Single(); Assert.Equal(("cpf", OrigemDado.Query, "abc-1"), (e.Campo, e.Source, e.CorrelationId));
        var outro = Guid.NewGuid();
        Assert.Equal(outro, g.Sanitizar("123.456.789-09", Sink.Log, new SanitizarOpcoes(UsuarioAlvoId: outro)).Eventos.Single().UsuarioAlvoId);
        Assert.Equal(("texto", OrigemDado.Http), (rastro.Eventos[1].Campo, rastro.Eventos[1].Source)); }

    [Fact] public void Excecao_nao_carrega_o_valor() {
        var ex = new TaintBloqueadoException(Sink.Log, PiiClasse.Cpf);
        Assert.Contains("Cpf", ex.Message); Assert.Contains("Log", ex.Message); Assert.Equal((Sink.Log, PiiClasse.Cpf), (ex.Sink, ex.Classe)); }

    private static ServiceProvider Provedor(params (string K, string V)[] extra)
    {
        var d = new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave };
        foreach (var (k, v) in extra) d[k] = v;
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(d).Build();
        var s = new ServiceCollection();
        s.AddSingleton<IConfiguration>(cfg);
        s.AddSingleton<IRastroSeguranca>(new RastroEmMemoria());
        s.AddSingleton<ITaintGuard, NoopTaintGuard>();   // o AddCyber precisa trocar este
        Ampara.Api.Cyber.CyberServiceCollectionExtensions.AddCyber(s, cfg);
        return s.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
    }
}
