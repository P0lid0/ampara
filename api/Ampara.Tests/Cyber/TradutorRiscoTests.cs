using System.Diagnostics;
using System.Net;
using System.Text;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Tests.Cyber;

public class TradutorRiscoTests
{
    private static readonly string Chave = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());

    private sealed class HandlerFalso(Func<CancellationToken, Task<HttpResponseMessage>> resposta) : HttpMessageHandler
    {
        private int _chamadas;
        public int Chamadas => _chamadas;
        public string UltimoCorpo { get; private set; } = "";
        public string ModeloEnviado { get; private set; } = "";
        public HttpRequestMessage? Ultima { get; private set; }
        public string? ChaveEnviada { get; private set; }
        public string? VersaoEnviada { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Interlocked.Increment(ref _chamadas);
            Ultima = request;
            UltimoCorpo = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
            using (var doc = System.Text.Json.JsonDocument.Parse(UltimoCorpo)) ModeloEnviado = doc.RootElement.GetProperty("model").GetString() ?? "";
            ChaveEnviada = request.Headers.GetValues("x-api-key").FirstOrDefault();
            VersaoEnviada = request.Headers.GetValues("anthropic-version").FirstOrDefault();
            return await resposta(ct);
        }
    }

    private sealed class FabricaFalsa(HttpMessageHandler h) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(h, disposeHandler: false);
    }

    private static Task<HttpResponseMessage> Ok(string json, HttpStatusCode s = HttpStatusCode.OK) =>
        Task.FromResult(new HttpResponseMessage(s) { Content = new StringContent(json, Encoding.UTF8, "application/json") });

    private static Task<HttpResponseMessage> Resposta(string texto) =>
        Ok("{\"content\":[{\"type\":\"text\",\"text\":" + System.Text.Json.JsonSerializer.Serialize(texto) + "}]}");

    private static HandlerFalso Handler(string texto) => new(_ => Resposta(texto));

    private static ITaintGuard GuardReal()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build();
        var s = new ServiceCollection();
        s.AddSingleton<IConfiguration>(cfg);
        s.AddSingleton<IRastroSeguranca>(new RastroEmMemoria());
        s.AddSingleton<ITaintGuard, NoopTaintGuard>();
        Ampara.Api.Cyber.CyberServiceCollectionExtensions.AddCyber(s, cfg);
        return s.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true }).CreateScope().ServiceProvider.GetRequiredService<ITaintGuard>();
    }

    private static ClaudeTradutorRisco Tradutor(HttpMessageHandler h, string? chave = "chave-de-teste", IMemoryCache? cache = null, string? modelo = null)
    {
        var d = new Dictionary<string, string?> { ["ANTHROPIC_API_KEY"] = chave, ["ANTHROPIC_MODEL"] = modelo };
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(d).Build();
        return new ClaudeTradutorRisco(new FabricaFalsa(h), cfg, GuardReal(), cache ?? new MemoryCache(new MemoryCacheOptions()), NullLogger<ClaudeTradutorRisco>.Instance);
    }

    private static ClaudeTradutorRisco TradutorCom(string cenario) => cenario switch
    {
        "sem-chave" => Tradutor(Handler("nunca chamado"), chave: null),
        "401" => Tradutor(new HandlerFalso(_ => Ok("{\"error\":{\"type\":\"authentication_error\"}}", HttpStatusCode.Unauthorized))),
        "500" => Tradutor(new HandlerFalso(_ => Ok("{\"error\":\"Error 500\"}", HttpStatusCode.InternalServerError))),
        "lento" => Tradutor(new HandlerFalso(async ct => { await Task.Delay(TimeSpan.FromSeconds(30), ct); return await Resposta("tarde demais para valer a pena"); })),
        "lixo" => Tradutor(new HandlerFalso(_ => Ok("isto nao e json {{{"))),
        _ => throw new ArgumentOutOfRangeException(nameof(cenario)),
    };

    [Fact]
    public async Task Prompt_leva_so_categoria_sink_e_tipo()
    {
        var h = Handler("Tentaram acessar seu documento, mas bloqueamos. Você não precisa fazer nada.");
        var msg = await Tradutor(h).TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        var corpo = h.UltimoCorpo;
        Assert.Contains("Cpf", corpo); Assert.Contains("Log", corpo); Assert.Contains("Bloqueado", corpo);
        Assert.DoesNotMatch(@"\d{4,}", corpo);
        Assert.Equal(1, h.Chamadas);
        Assert.Equal("claude-haiku-5-5", h.ModeloEnviado);
        Assert.Equal("Tentaram acessar seu documento, mas bloqueamos. Você não precisa fazer nada.", msg);
        Assert.Equal("chave-de-teste", h.ChaveEnviada); Assert.Equal("2023-06-01", h.VersaoEnviada);
        Assert.Equal("https://api.anthropic.com/v1/messages", h.Ultima!.RequestUri!.ToString());
        Assert.Contains("max_tokens\":200", corpo); Assert.Contains("\"system\"", corpo);
    }

    [Fact]
    public async Task Modelo_vem_da_configuracao()
    {
        var h = Handler("Tentaram acessar seu documento, mas bloqueamos. Você não precisa fazer nada.");
        await Tradutor(h, modelo: "outro-modelo").TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        Assert.Equal("outro-modelo", h.ModeloEnviado);
    }

    [Fact]
    public async Task Valor_no_tipo_nunca_sai()   // SINTETICO
    {
        var h = Handler("x");
        var msg = await Tradutor(h).TraduzirAsync(new("Cpf", "Log", "529.982.247-25"));
        Assert.Equal(0, h.Chamadas);
        Assert.Equal(FrasesPadrao.FalhaSistema, msg);
    }

    [Theory]
    [InlineData("sem-chave")] [InlineData("401")] [InlineData("500")] [InlineData("lento")] [InlineData("lixo")]
    public async Task Falhas_caem_na_frase_padrao_em_ate_5s(string cenario)
    {
        var sw = Stopwatch.StartNew();
        var msg = await TradutorCom(cenario).TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        Assert.Equal(FrasesPadrao.Bloqueado, msg);
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(6));
    }

    [Fact]
    public async Task Sem_chave_nao_faz_chamada_http()
    {
        var h = Handler("nunca chamado");
        await Tradutor(h, chave: "").TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        Assert.Equal(0, h.Chamadas);
    }

    [Theory]
    [InlineData("")] [InlineData("curta demais")] [InlineData("a")]
    public async Task Resposta_vazia_ou_curta_demais_usa_frase_padrao(string texto)
    {
        var msg = await Tradutor(Handler(texto)).TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        Assert.Equal(FrasesPadrao.Bloqueado, msg);
    }

    [Fact]
    public async Task Resposta_longa_demais_usa_frase_padrao_e_nao_vai_para_o_cache()
    {
        var h = Handler(new string('a', 301));
        var t = Tradutor(h);
        Assert.Equal(FrasesPadrao.Bloqueado, await t.TraduzirAsync(new("Cpf", "Log", "Bloqueado")));
        await t.TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        Assert.Equal(2, h.Chamadas);   // frase padrao nao entra no cache
    }

    [Fact]
    public void Frases_padrao_tem_duas_frases_e_ninguem_diz_Error_500() =>
        Assert.All(FrasesPadrao.Todas, f => { Assert.Equal(2, f.Count(c => c == '.')); Assert.DoesNotContain("Error", f); Assert.DoesNotContain("500", f); });

    // Revisão final do plano 03 (regressao-1): recusa de regra nunca vira "falha do nosso lado, tente em alguns minutos".
    [Fact]
    public void Frases_de_recusa_tem_duas_frases_e_nao_culpam_o_sistema() =>
        Assert.All(FrasesPadrao.Recusas, f => { Assert.Equal(2, f.Count(c => c == '.')); Assert.DoesNotContain("nosso lado", f); Assert.DoesNotContain("Error", f); });

    [Theory]
    [InlineData("credenciais-invalidas", "CredenciaisInvalidas")] [InlineData("convite-invalido", "ConviteInvalido")]
    [InlineData("convite-vencido", "ConviteVencido")] [InlineData("limite-guardioes", "LimiteGuardioes")]
    [InlineData("relato-abusivo", "RelatoAbusivo")] [InlineData("limite-relatos", "MuitasTentativas")]
    [InlineData("ocorrencia-nao-encontrada", "NaoEncontrado")] [InlineData("ocorrencia-de-outro-usuario", "SemPermissao")]
    [InlineData("imei-invalido", "RecusaPadrao")]
    public void Recusa_escolhe_frase_pelo_codigo(string codigo, string esperada) =>
        Assert.Equal(typeof(FrasesPadrao).GetField(esperada)!.GetValue(null), FrasesPadrao.Para(EventoTecnico.Recusa(codigo)));

    [Fact]
    public async Task Recusa_com_chave_nao_chama_a_IA_e_devolve_a_frase_do_codigo()
    {
        var h = Handler("Algo deu errado do nosso lado. Tente de novo em alguns minutos.");
        var t = Tradutor(h);
        Assert.Equal(FrasesPadrao.ConviteInvalido, await t.TraduzirAsync(EventoTecnico.Recusa("convite-invalido")));
        Assert.Equal(0, h.Chamadas);
    }

    [Theory]
    [InlineData("Bloqueado", "Bloqueado")] [InlineData("Mascarado", "Protegido")] [InlineData("Cifrado", "Protegido")]
    [InlineData("Permitido", "Permitido")] [InlineData("AcessoIndevido", "AcessoIndevido")] [InlineData("Qualquer", "FalhaSistema")]
    public void Frase_padrao_escolhida_pelo_tipo(string tipo, string esperada) =>
        Assert.Equal(typeof(FrasesPadrao).GetField(esperada)!.GetValue(null), FrasesPadrao.Para(tipo));

    [Fact]
    public async Task Segunda_chamada_igual_usa_cache()
    {
        var h = Handler("Tentaram acessar seu documento, mas bloqueamos. Você não precisa fazer nada.");
        var t = Tradutor(h);
        var a = await t.TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        var b = await t.TraduzirAsync(new("Cpf", "Log", "Bloqueado"));
        Assert.Equal(a, b);
        Assert.Equal(1, h.Chamadas);
        await t.TraduzirAsync(new("Cpf", "Banco", "Mascarado"));   // chave diferente: nova chamada
        Assert.Equal(2, h.Chamadas);
    }

    [Fact]
    public void EventoTecnico_usa_classe_sink_e_decisao_ou_AcessoIndevido()
    {
        var comum = EventoSeguranca.Novo(DateTimeOffset.UtcNow, "c", OrigemDado.Http, "cpf", PiiClasse.Cpf, Sink.Log, Decisao.Bloqueado, null);
        Assert.Equal(new EventoTecnico("Cpf", "Log", "Bloqueado"), EventoTecnico.De(comum));
        var indevido = EventoSeguranca.Novo(DateTimeOffset.UtcNow, "c", OrigemDado.Http, IndiceRisco.CampoCodigoEmergencia, PiiClasse.Senha, Sink.HttpNaoAutenticada, Decisao.Bloqueado, null);
        Assert.Equal(new EventoTecnico("AcessoIndevido", "HttpNaoAutenticada", "AcessoIndevido"), EventoTecnico.De(indevido));
    }

    private sealed class TradutorFalso(string frase) : ITradutorRisco
    {
        public Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default) => Task.FromResult(frase);
    }

    private sealed class RepoFalso : IEventoSegurancaRepository
    {
        public List<EventoSeguranca> Itens { get; } = [];
        public Task AdicionarAsync(EventoSeguranca e, CancellationToken ct = default) { Itens.Add(e); return Task.CompletedTask; }
        public Task<IReadOnlyList<EventoSeguranca>> DesdeAsync(DateTimeOffset desde, Guid? usuarioAlvoId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<EventoSeguranca>>(Itens);
    }

    [Fact]
    public async Task Worker_preenche_MensagemCidadao_antes_de_persistir()
    {
        var repo = new RepoFalso();
        var sp = new ServiceCollection()
            .AddSingleton<IEventoSegurancaRepository>(repo)
            .AddSingleton<ITradutorRisco>(new TradutorFalso("Frase do falso. Segunda frase do falso."))
            .BuildServiceProvider();
        var w = new RastroSegurancaWorker(new RastroSeguranca(), sp.GetRequiredService<IServiceScopeFactory>(), NullLogger<RastroSegurancaWorker>.Instance);
        var e = EventoSeguranca.Novo(DateTimeOffset.UtcNow, "c", OrigemDado.Http, "cpf", PiiClasse.Cpf, Sink.Log, Decisao.Bloqueado, null);

        await w.ProcessarAsync(e, CancellationToken.None);

        Assert.Equal("Frase do falso. Segunda frase do falso.", repo.Itens[0].MensagemCidadao);
    }

    [Fact]
    public void AddCyber_registra_o_tradutor_real()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build();
        var s = new ServiceCollection();
        s.AddSingleton<IConfiguration>(cfg); s.AddLogging();
        s.AddSingleton<IRastroSeguranca>(new RastroEmMemoria());
        Ampara.Api.Cyber.CyberServiceCollectionExtensions.AddCyber(s, cfg);
        using var sp = s.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        using var escopo = sp.CreateScope();
        Assert.IsType<ClaudeTradutorRisco>(escopo.ServiceProvider.GetRequiredService<ITradutorRisco>());
    }
}
