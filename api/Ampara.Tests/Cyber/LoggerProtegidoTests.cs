using System.Net.Http.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ampara.Tests.Cyber;

public class LoggerProtegidoTests
{
    private static readonly string Chave = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO

    public sealed record Linha(string Categoria, LogLevel Nivel, EventId Id, string Texto);

    /// <summary>Provedor que guarda exatamente o que recebe.</summary>
    public sealed class Captura : ILoggerProvider
    {
        public List<Linha> Linhas { get; } = [];
        public ILogger CreateLogger(string categoria) => new L(this, categoria);
        public void Dispose() { }
        private sealed class L(Captura c, string cat) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel n) => true;
            public void Log<TState>(LogLevel n, EventId id, TState s, Exception? e, Func<TState, Exception?, string> f)
            { lock (c.Linhas) c.Linhas.Add(new Linha(cat, n, id, f(s, e))); }
        }
    }

    private static TaintGuard Guard(bool taintAtivo = true, bool demo = false)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build();
        return new TaintGuard(new PiiScanner(DetectoresTests.TodosDetectores()), new TaintScope(), new PiiProtetor(cfg), new RastroEmMemoria(),
            Options.Create(new CyberOptions { TaintAtivo = taintAtivo, Demo = demo }));
    }

    private static (ILogger Logger, Captura Cap) Novo(bool taintAtivo = true, bool demo = false)
    {
        var cap = new Captura();
        var fabrica = new GuardedLoggerFactory(new LoggerFactory([cap]), () => Guard(taintAtivo, demo));
        return (fabrica.CreateLogger("Teste.Categoria"), cap);
    }

    private static string Logar(bool taintAtivo, bool demo, string texto)
    {
        var (logger, cap) = Novo(taintAtivo, demo);
        logger.LogInformation("{Texto}", texto);
        return Assert.Single(cap.Linhas).Texto;
    }

    [Fact] public void Cpf_no_template_nao_chega_ao_provedor() {   // SINTETICO
        var (logger, cap) = Novo(); logger.LogInformation("Cadastro do CPF {Cpf}", "529.982.247-25");
        var linha = Assert.Single(cap.Linhas); Assert.DoesNotContain("529.982.247-25", linha.Texto); Assert.Contains("[BLOQUEADO:Cpf]", linha.Texto);
        Assert.Equal(LogLevel.Information, linha.Nivel); Assert.Equal("Teste.Categoria", linha.Categoria); }

    [Fact] public void Excecao_com_pii_e_sanitizada() {   // SINTETICO
        var (logger, cap) = Novo(); logger.LogError(new InvalidOperationException("falha com 529.982.247-25"), "x");
        var linha = Assert.Single(cap.Linhas); Assert.DoesNotContain("529.982.247-25", linha.Texto);
        Assert.Contains("InvalidOperationException", linha.Texto); Assert.Contains("[BLOQUEADO:Cpf]", linha.Texto); Assert.Equal(LogLevel.Error, linha.Nivel); }

    [Fact] public void Sensitive_aparece_mascarado() {
        var (logger, cap) = Novo(); logger.LogInformation("{S}", new Sensitive<string>("segredo", PiiClasse.Senha, "senha"));
        var texto = Assert.Single(cap.Linhas).Texto; Assert.Contains("[PII:Senha]", texto); Assert.DoesNotContain("segredo", texto); }

    [Fact] public void Mensagem_limpa_passa_igual() {
        var (logger, cap) = Novo(); logger.Log(LogLevel.Warning, new EventId(7, "Ev"), "ola {N}", 42);
        var linha = Assert.Single(cap.Linhas); Assert.Equal("ola 42", linha.Texto);
        Assert.Equal(LogLevel.Warning, linha.Nivel); Assert.Equal(new EventId(7, "Ev"), linha.Id); }

    [Fact] public void IsEnabled_delega_ao_logger_real() {
        var cap = new Captura();
        var fabrica = new GuardedLoggerFactory(LoggerFactory.Create(b => b.AddProvider(cap).SetMinimumLevel(LogLevel.Warning)), () => Guard());
        var logger = fabrica.CreateLogger("c");
        Assert.False(logger.IsEnabled(LogLevel.Information)); Assert.True(logger.IsEnabled(LogLevel.Error));
        logger.LogInformation("nao entra"); Assert.Empty(cap.Linhas); }

    [Fact] public void Falha_do_guard_descarta_o_conteudo() {
        var cap = new Captura();
        var logger = new GuardedLoggerFactory(new LoggerFactory([cap]), () => throw new InvalidOperationException("sem guard")).CreateLogger("c");
        logger.LogInformation("cpf {C}", "529.982.247-25");   // SINTETICO
        Assert.Equal(GuardedLogger.Suprimido, Assert.Single(cap.Linhas).Texto); }

    [Fact] public void Antes_e_depois_com_a_flag_de_demonstracao() {   // evidência do PDF   SINTETICO
        Assert.Contains("529.982.247-25", Logar(taintAtivo: false, demo: true, "cpf 529.982.247-25"));
        Assert.DoesNotContain("529.982.247-25", Logar(taintAtivo: true, demo: true, "cpf 529.982.247-25")); }

    [Fact] public async Task Senha_no_corpo_nao_vai_ao_log() {   // Review Focus 2   SINTETICO
        var cap = new Captura();
        await using var h = await CyberTestHost.IniciarAsync(
            m => m.MapPost("/api/v1/auth/registrar", async (HttpContext c, ILogger<LoggerProtegidoTests> log) => {
                var corpo = await c.Request.ReadFromJsonAsync<Corpo>();
                log.LogInformation("recebido {@Corpo}", corpo);
                return Results.Ok(); }),
            s => s.AddSingleton<ILoggerProvider>(cap));
        var r = await h.GetTestClient().PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Maria", email = "maria@exemplo.com", senha = "Sint3tica!2026" });
        r.EnsureSuccessStatusCode();
        var todas = cap.Linhas.Where(l => l.Texto.Contains("recebido")).ToList();
        Assert.NotEmpty(todas);
        Assert.All(cap.Linhas, l => Assert.DoesNotContain("Sint3tica!2026", l.Texto)); }

    public sealed record Corpo(string Nome, string Email, string Senha);
}
