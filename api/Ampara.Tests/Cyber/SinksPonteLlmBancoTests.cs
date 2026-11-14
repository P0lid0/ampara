using System.Net;
using System.Text;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Ampara.Tests.Cyber;

public class SinksPonteLlmBancoTests
{
    private static readonly string Chave = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO

    private sealed class InnerFalso : HttpMessageHandler
    {
        public int Chamadas;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Chamadas++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }
    }

    public sealed class NotaDeTeste
    {
        public int Id { get; set; }
        [TextoLivre] public string? Texto { get; set; }
        [PiiCifrado(PiiClasse.Imei)] public string? ImeiCifrado { get; set; }
    }

    private sealed class TesteDbContext(DbContextOptions<TesteDbContext> o) : DbContext(o)
    {
        public DbSet<NotaDeTeste> Notas => Set<NotaDeTeste>();
    }

    private readonly RastroEmMemoria _rastro = new();
    private readonly PiiProtetor _protetor;
    private readonly TaintGuard _guard;
    private List<EventoSeguranca> Eventos => _rastro.Eventos;

    public SinksPonteLlmBancoTests()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build();
        _protetor = new PiiProtetor(cfg);
        _guard = new TaintGuard(new PiiScanner(DetectoresTests.TodosDetectores()), new TaintScope(), _protetor, _rastro,
            Options.Create(new CyberOptions { TaintAtivo = true }));
    }

    private HttpClient ClienteComHandler(string baseUrl, InnerFalso inner, string? ponteUrl = "http://localhost:8000")
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["PONTE_URL"] = ponteUrl }).Build();
        var handler = new TaintHttpHandler(_guard, cfg) { InnerHandler = inner };
        return new HttpClient(handler) { BaseAddress = new Uri(baseUrl) };
    }

    private TesteDbContext NovoDb()
    {
        var opcoes = new DbContextOptionsBuilder<TesteDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new TaintSaveChangesInterceptor(_guard, _protetor, _rastro)).Options;
        return new TesteDbContext(opcoes);
    }

    private static StringContent Json(string corpo) => new(corpo, Encoding.UTF8, "application/json");

    [Fact] public async Task Payload_da_ponte_valido_passa() {            // Review Focus 1
        var h = new InnerFalso(); var c = ClienteComHandler("http://localhost:8000", h);
        var corpo = """{"origem_id":"3f2b8c1e-5a4d-4e0b-9c7a-1d2e3f4a5b6c","area_id":"g051_026","ts":"2026-11-14T12:00:00Z","tipo":"roubo_celular","origem_gatilho":"chaveiro","device_hash":"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08","trilha":[{"lat":-23.5672490,"lng":-46.7019515,"em":"2026-11-14T11:58:00Z"}]}""";
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync("/ocorrencias", Json(corpo))).StatusCode); Assert.Equal(1, h.Chamadas); Assert.Empty(Eventos); }

    [Fact] public async Task Ponte_com_email_ou_cpf_e_bloqueada_e_nao_e_enviada() {   // SINTETICO
        var h = new InnerFalso(); var c = ClienteComHandler("http://localhost:8000", h);
        await Assert.ThrowsAsync<TaintBloqueadoException>(() => c.PostAsync("/ocorrencias", Json("""{"nome":"x","email":"maria.teste@exemplo.com"}""")));
        Assert.Equal(0, h.Chamadas); Assert.Equal((Sink.Ponte, Decisao.Bloqueado, PiiClasse.Email), (Eventos[0].Sink, Eventos[0].Decisao, Eventos[0].Classe));
        await Assert.ThrowsAsync<TaintBloqueadoException>(() => c.PostAsync("/ocorrencias", Json("""{"doc":"529.982.247-25"}""")));
        Assert.Equal(0, h.Chamadas); }

    [Fact] public async Task Llm_com_valor_tainted_e_bloqueado() {   // SINTETICO
        var h = new InnerFalso(); var c = ClienteComHandler("https://api.anthropic.com", h);
        var ex = await Assert.ThrowsAsync<TaintBloqueadoException>(() => c.PostAsync("/v1/messages", Json("""{"prompt":"cpf 529.982.247-25"}""")));
        Assert.Equal(Sink.Llm, ex.Sink); Assert.DoesNotContain("529.982.247-25", ex.Message);
        Assert.Equal(0, h.Chamadas); Assert.Equal(Sink.Llm, Eventos[0].Sink); }

    [Fact] public async Task Host_desconhecido_passa_direto() {   // SINTETICO
        var h = new InnerFalso(); var c = ClienteComHandler("https://exemplo.test", h);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync("/x", Json("""{"cpf":"529.982.247-25"}"""))).StatusCode);
        Assert.Equal(1, h.Chamadas); Assert.Empty(Eventos); }

    [Fact] public async Task Texto_livre_e_mascarado_ao_salvar() {   // SINTETICO
        await using var db = NovoDb();
        db.Notas.Add(new NotaDeTeste { Texto = "roubaram no ponto, meu cpf 529.982.247-25" }); await db.SaveChangesAsync();
        Assert.Contains("***.982.***-25", db.Notas.Single().Texto); Assert.DoesNotContain("529.982.247-25", db.Notas.Single().Texto);
        Assert.Equal((Sink.Banco, Decisao.Mascarado), (Eventos[0].Sink, Eventos[0].Decisao)); }

    [Fact] public async Task Imei_em_texto_puro_e_cifrado_e_cifrado_nao_e_recifrado() {   // SINTETICO
        await using var db = NovoDb();
        db.Notas.Add(new NotaDeTeste { ImeiCifrado = "490154203237518" }); await db.SaveChangesAsync();
        var salvo = db.Notas.Single().ImeiCifrado; Assert.StartsWith("enc:v1:", salvo); Assert.Equal("490154203237518", _protetor.Decifrar(salvo!));
        Assert.Equal((Sink.Banco, Decisao.Cifrado, PiiClasse.Imei), (Eventos[0].Sink, Eventos[0].Decisao, Eventos[0].Classe));
        db.Notas.Single().ImeiCifrado = salvo; await db.SaveChangesAsync(); Assert.Equal(salvo, db.Notas.Single().ImeiCifrado);
        Assert.Single(Eventos); }
}
