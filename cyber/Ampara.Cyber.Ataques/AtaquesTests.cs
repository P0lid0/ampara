using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Ampara.Api.Cyber;
using Ampara.Application.Chaveiros;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Ampara.Infrastructure.Mqtt;
using Ampara.Tests.Cyber;
using Microsoft.AspNetCore.SignalR.Protocol;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Cyber.Ataques;

/// <summary>
/// Cada teste é um ataque contra a API real. "Vazou" = o valor sintético aparece em log capturado, em corpo anônimo,
/// em prompt ou em rastro. Nenhum CPF/IMEI aqui é de pessoa real.
/// </summary>
public class AtaquesTests(ResumoAtaques resumo) : IClassFixture<ResumoAtaques>
{
    private const string Cpf = "529.982.247-25";   // SINTETICO (dígitos verificadores válidos)
    private const string CpfSemMascara = "52998224725";   // SINTETICO
    private const string SenhaSintetica = "Sintetica!2026";   // SINTETICO
    private const string TipoProblema = "application/problem+json";

    // Qualquer destas formas no texto é vazamento do CPF.
    private static readonly string[] FormasDoCpf = [Cpf, CpfSemMascara, "982.247", "９８２"];

    private static StringContent Json(string corpo) => new(corpo, Encoding.UTF8, "application/json");

    // O correlationId é aleatório (hex): um "F32" ou "982" nele não é vazamento, então fica fora das buscas por pedaços curtos.
    private static string SemCorrelacao(string corpo) => Regex.Replace(corpo, "\"correlationId\":\"[^\"]*\"", "");

    private static void SemCpf(string texto, string onde)
    {
        foreach (var forma in FormasDoCpf)
            Assert.False(texto.Contains(forma, StringComparison.Ordinal), $"{onde} contém '{forma}'");
    }

    private static void SemCpfNoLog(FabricaDeAtaque f, params string[] extras)
    {
        foreach (var linha in f.Log.Linhas)
        {
            SemCpf(linha, "log");
            foreach (var x in extras) Assert.False(linha.Contains(x, StringComparison.Ordinal), $"log contém '{x}'");
        }
    }

    private Task Ataque(string id, string vetor, string esperado, Func<Task<string>> corpo) => resumo.RodarAsync(id, vetor, esperado, corpo);

    // A barra e montada em runtime: um "\u" escrito no fonte seria decodificado pelas ferramentas de edicao e viraria texto puro.
    private static readonly string Barra = ((char)92).ToString();

    /// <summary>JSON {"doc":"..."} com o valor escrito em sequencias de escape (so os digitos, ou todos os caracteres).</summary>
    private static string JsonComEscape(string valor, bool soDigitos) =>
        "{\"doc\":\"" + string.Concat(valor.Select(c => !soDigitos || char.IsAsciiDigit(c) ? Barra + "u" + ((int)c).ToString("x4") : c.ToString())) + "\"}";

    private static async Task<(HttpResponseMessage R, string Corpo)> PostEco(HttpClient c, string json)
    {
        var r = await c.PostAsync("/eco", Json(json));
        return (r, await r.Content.ReadAsStringAsync());
    }

    private static void AssertBloqueioProblem(HttpResponseMessage r, string corpo)
    {
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal(TipoProblema, r.Content.Headers.ContentType!.MediaType);
        Assert.Contains("urn:ampara:taint:bloqueado", corpo);
    }

    [Fact]
    public Task A01_cpf_no_json_ecoado_por_endpoint_anonimo_e_bloqueado() => Ataque(
        "A01", "CPF em JSON ecoado por endpoint anonimo", "500 problem+json, CPF ausente, evento HttpNaoAutenticada/Bloqueado", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var (r, corpo) = await PostEco(f.CreateClient(), $$"""{"nome":"Pessoa Teste","documento":"{{Cpf}}"}""");

        AssertBloqueioProblem(r, corpo);
        SemCpf(corpo, "corpo");
        ResumoAtaques.GravarExemplo("a01-resposta-bloqueada", "POST /eco  {\"nome\":\"Pessoa Teste\",\"documento\":\"<CPF sintetico>\"}", (int)r.StatusCode, r.Content.Headers.ContentType?.MediaType, corpo);
        Assert.Contains("detalheCidadao", corpo);
        Assert.Single(f.Rastro.Eventos, e => (e.Sink, e.Decisao, e.Classe) == (Sink.HttpNaoAutenticada, Decisao.Bloqueado, PiiClasse.Cpf));
        SemCpfNoLog(f);
        return "bloqueado com 500 problem+json, 1 evento, CPF ausente do corpo e do log";
    });

    [Fact]
    public Task A02_cpf_ofuscado_fullwidth_nbsp_e_escape_unicode_e_detectado() => Ataque(
        "A02", "CPF ofuscado (fullwidth, NBSP, zero-width, hifen suave, travessao, marca de direcao, digitos arabe-indicos, escape unicode no JSON)", "todas as formas bloqueadas, nenhum digito na resposta", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var c = f.CreateClient();
        var formas = new Dictionary<string, string>
        {
            ["fullwidth"] = """{"doc":"５２９.９８２.２４７-２５"}""",
            ["fullwidth-com-separador-largo"] = """{"doc":"５２９．９８２．２４７－２５"}""",
            ["nbsp"] = "{\"doc\":\"529 982 247 25\"}",
            ["zero-width"] = "{\"doc\":\"529​.982​.247-25\"}",
            ["hifen-suave"] = "{\"doc\":\"529\u00AD982\u00AD247\u00AD25\"}",
            ["travessao-curto"] = "{\"doc\":\"529.982.247\u201325\"}",
            ["marca-de-direcao"] = "{\"doc\":\"529\u200E.982\u2063.247-25\"}",
            ["digitos-arabe-indicos"] = "{\"doc\":\"\u0665\u0662\u0669.\u0669\u0668\u0662.\u0662\u0664\u0667-\u0662\u0665\"}",
            ["escape-unicode"] = JsonComEscape(Cpf, soDigitos: true),
            ["escape-unicode-total"] = JsonComEscape(Cpf, soDigitos: false),
        };
        foreach (var (nome, json) in formas)
        {
            if (nome.StartsWith("escape-unicode", StringComparison.Ordinal))
                Assert.Contains(Barra + "u0035", json);   // controle: o corpo enviado traz mesmo a sequencia de escape (nao o CPF em texto puro)
            var (r, corpo) = await PostEco(c, json);
            Assert.True(r.StatusCode == HttpStatusCode.InternalServerError, $"{nome}: status {(int)r.StatusCode}");
            Assert.Equal(TipoProblema, r.Content.Headers.ContentType!.MediaType);
            Assert.Contains("urn:ampara:taint:bloqueado", corpo);
            Assert.False(Regex.IsMatch(SemCorrelacao(corpo), @"529|982|247"), $"{nome}: a resposta tem um pedaco do CPF");
            Assert.DoesNotContain("u0035", corpo);
            foreach (var pedaco in new[] { "９", "２", "982", "247", "\u0669\u0668\u0662" }) Assert.DoesNotContain(pedaco, SemCorrelacao(corpo));
        }
        Assert.True(f.Rastro.Eventos.Count(e => e.Classe == PiiClasse.Cpf && e.Sink == Sink.HttpNaoAutenticada) >= formas.Count);
        return $"{formas.Count} formas ofuscadas, todas bloqueadas com 500 problem+json";
    });

    [Fact]
    public Task A03_pii_em_cabecalho_query_e_formulario_nao_chega_ao_log() => Ataque(
        "A03", "CPF em cabecalho, query string e formulario, registrados por um endpoint de depuracao", "nenhuma linha de log contem o CPF", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var c = f.CreateClient();

        var porCabecalho = new HttpRequestMessage(HttpMethod.Get, "/eco-log");
        porCabecalho.Headers.Add("X-Documento", Cpf);
        Assert.Equal(HttpStatusCode.NoContent, (await c.SendAsync(porCabecalho)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await c.GetAsync($"/eco-log?cpf={Cpf}&x=1")).StatusCode);

        var form = new FormUrlEncodedContent([new("cpf", Cpf), new("nome", "Pessoa Teste")]);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PostAsync("/eco-log", form)).StatusCode);

        var linhasDoEndpoint = f.Log.Linhas.Where(l => l.Contains("recebido query=", StringComparison.Ordinal)).ToList();
        Assert.Equal(3, linhasDoEndpoint.Count);   // o endpoint logou as 3 vezes: ausência de CPF não é ausência de log
        SemCpfNoLog(f);
        Assert.Contains(f.Rastro.Eventos, e => e.Sink == Sink.Log && e.Classe == PiiClasse.Cpf);
        return "3 linhas de log do endpoint, CPF ausente de todas";
    });

    [Fact]
    public Task A04_excecao_com_laudo_e_cpf_vira_frase_humana() => Ataque(
        "A04", "excecao com laudo e CPF na mensagem", "500 problem+json com frase humana, sem 'Error 500', sem stack, sem CPF", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var r = await f.CreateClient().GetAsync("/explode");
        var corpo = await r.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal(TipoProblema, r.Content.Headers.ContentType!.MediaType);
        SemCpf(corpo, "corpo");
        ResumoAtaques.GravarExemplo("a04-erro-500", "GET /explode  (excecao com laudo e CPF na mensagem)", (int)r.StatusCode, r.Content.Headers.ContentType?.MediaType, corpo);
        foreach (var tecnico in new[] { "Error 500", "InvalidOperation", "Exception", "at Ampara", "StackTrace", "laudo", "diagnostico", "F32" })
            Assert.DoesNotContain(tecnico, SemCorrelacao(corpo), StringComparison.OrdinalIgnoreCase);
        var frase = JsonDocument.Parse(corpo).RootElement.GetProperty("detalheCidadao").GetString();
        Assert.False(string.IsNullOrWhiteSpace(frase));
        Assert.Contains(f.Rastro.Eventos, e => e is { Classe: PiiClasse.Cpf, Sink: Sink.Erro, Decisao: Decisao.Bloqueado });
        Assert.Contains(f.Rastro.Eventos, e => e is { Classe: PiiClasse.Saude, Sink: Sink.Erro });
        SemCpfNoLog(f);
        return "500 problem+json com detalheCidadao em linguagem simples; eventos Erro/Bloqueado de CPF e Saude";
    });

    [Fact]
    public Task A05_mensagem_mqtt_com_cpf_e_armazenada_mascarada() => Ataque(
        "A05", "mensagem MQTT do chaveiro com CPF no campo livre", "o servico recebe o payload com o CPF mascarado; deviceId e eventId intactos", async () =>
    {
        await using var f = new FabricaDeAtaque();
        _ = f.CreateClient();
        var espiao = new EventoEspiao();
        var sp = new ServiceCollection()
            .AddSingleton(f.Services.GetRequiredService<IMqttPiiFilter>())
            .AddScoped<IChaveiroEventoService>(_ => espiao)
            .BuildServiceProvider();
        using var gw = new MqttChaveiroGateway(sp.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System,
            new ConfigurationBuilder().Build(), NullLogger<MqttChaveiroGateway>.Instance);

        await gw.DespacharAsync("citizentech/chaveiro/chaveiro-ampara-a1b2c3/events",
            $$"""{"deviceId":"chaveiro-ampara-a1b2c3","type":"alert","eventId":"e-001","ts":"2026-11-14T12:00:00Z","nota":"socorro, meu cpf {{Cpf}}"}""");

        var (deviceId, payload) = Assert.Single(espiao.Recebidos);
        SemCpf(payload, "payload entregue ao servico");
        Assert.Equal("chaveiro-ampara-a1b2c3", deviceId);
        var o = JsonDocument.Parse(payload).RootElement;
        Assert.Equal("e-001", o.GetProperty("eventId").GetString());
        Assert.Contains("***.982.***-25", o.GetProperty("nota").GetString());
        var ev = Assert.Single(f.Rastro.Eventos, e => e.Source == OrigemDado.Mqtt);
        Assert.Equal((Sink.Banco, Decisao.Mascarado, PiiClasse.Cpf), (ev.Sink, ev.Decisao, ev.Classe));
        SemCpfNoLog(f);
        return "payload entregue com ***.982.***-25, evento Mqtt/Banco/Mascarado, CPF ausente do log";
    });

    private sealed class EventoEspiao : IChaveiroEventoService
    {
        public List<(string DeviceId, string Payload)> Recebidos { get; } = [];
        public Task TratarEventoAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct)
        { Recebidos.Add((deviceIdDoTopico, payload)); return Task.CompletedTask; }
        public Task TratarStatusAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct)
        { Recebidos.Add((deviceIdDoTopico, payload)); return Task.CompletedTask; }
    }

    [Fact]
    public Task A06_senha_na_resposta_publica_e_bloqueada() => Ataque(
        "A06", "senha ecoada em resposta publica (JSON e texto puro)", "500 problem+json, senha ausente, evento Senha/Bloqueado", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var c = f.CreateClient();

        var (r, corpo) = await PostEco(c, $$"""{"usuario":"demo","senha":"{{SenhaSintetica}}"}""");
        AssertBloqueioProblem(r, corpo);
        Assert.DoesNotContain(SenhaSintetica, corpo);

        var texto = await c.PostAsync("/eco", new StringContent($"sua senha: {SenhaSintetica}", Encoding.UTF8, "text/plain"));
        var corpoTexto = await texto.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.InternalServerError, texto.StatusCode);
        Assert.DoesNotContain(SenhaSintetica, corpoTexto);

        Assert.Contains(f.Rastro.Eventos, e => (e.Sink, e.Decisao, e.Classe) == (Sink.HttpNaoAutenticada, Decisao.Bloqueado, PiiClasse.Senha));
        Assert.DoesNotContain(f.Log.Linhas, l => l.Contains(SenhaSintetica, StringComparison.Ordinal));
        return "bloqueado nas duas formas, senha ausente do corpo e do log";
    });

    [Fact]
    public Task A07_imei_so_para_o_dono_autenticado_e_intruso_gera_acesso_indevido() => Ataque(
        "A07", "IMEI no BO: dono, anonimo e outro usuario autenticado", "so o dono ve o IMEI; o intruso leva 403 e vira acesso indevido (peso 40) para a vitima", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var v = await CyberTestHelpers.CriarVitimaComOcorrenciaAsync(f.CreateClient());

        var doDono = await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo");
        Assert.Contains(CyberTestHelpers.Imei, doDono.GetProperty("texto").GetString());

        var anonimo = await f.CreateClient().GetAsync($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo");
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.DoesNotContain(CyberTestHelpers.Imei, await anonimo.Content.ReadAsStringAsync());

        var intruso = await CyberTestHelpers.CriarUsuarioAsync(f.CreateClient(), "Intruso Teste");
        var negado = await intruso.Cliente.GetAsync($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo");
        Assert.Equal(HttpStatusCode.Forbidden, negado.StatusCode);
        Assert.Equal(TipoProblema, negado.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain(CyberTestHelpers.Imei, await negado.Content.ReadAsStringAsync());

        // A rota que lista aparelhos mostra só os 4 últimos dígitos.
        Assert.DoesNotContain(CyberTestHelpers.Imei, await v.Cliente.GetStringAsync("/api/v1/aparelhos"));

        var indevidos = (await f.EventosNoBancoAsync(v.UsuarioId)).Where(IndiceRisco.EhAcessoIndevido).ToList();
        Assert.Single(indevidos);
        Assert.Equal(40, IndiceRisco.Peso(indevidos[0]));
        var permitidos = f.Rastro.Eventos.Where(e => e.Campo == "bo.imei" && e.UsuarioAlvoId == v.UsuarioId).ToList();
        Assert.Single(permitidos);   // só a leitura do dono foi "Permitido"; a do intruso nunca aparece como permitida
        Assert.Equal(Decisao.Permitido, permitidos[0].Decisao);
        Assert.DoesNotContain(f.Log.Linhas, l => l.Contains(CyberTestHelpers.Imei, StringComparison.Ordinal));
        return "dono recebe; anonimo 401; intruso 403; 1 acesso indevido de peso 40 para a vitima; IMEI fora do log";
    });

    [Fact]
    public Task A08_prompt_ao_claude_nao_contem_valor_nenhum() => Ataque(
        "A08", "prompt enviado ao Claude depois de eventos com CPF, senha, laudo e acesso indevido", "o corpo enviado so tem categoria, sink e tipo: sem digitos longos nem pedacos do CPF", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var c = f.CreateClient();
        await PostEco(c, $$"""{"documento":"{{Cpf}}"}""");
        await PostEco(c, $$"""{"senha":"{{SenhaSintetica}}"}""");
        await c.GetAsync("/explode");
        var u = await CyberTestHelpers.CriarUsuarioAsync(f.CreateClient());
        foreach (var cenario in new[] { "cpf-no-log", "senha-na-resposta", "laudo-no-erro", "acesso-indevido" })
            Assert.Equal(HttpStatusCode.Accepted, (await u.Cliente.PostAsJsonAsync("/api/v1/seguranca/simular-ataque", new { cenario })).StatusCode);

        var prompts = f.Rede.Pedidos.Where(p => p.Url.Host == "api.anthropic.com").Select(p => p.Corpo).ToList();
        Assert.NotEmpty(prompts);   // sem isto o teste passaria no vazio
        Assert.DoesNotContain(f.Rastro.Eventos, e => e.Sink == Sink.Llm);   // nada foi barrado no caminho do Claude
        foreach (var corpo in prompts)
        {
            Assert.False(Regex.IsMatch(corpo, @"\d{4,}"), "prompt com 4 digitos seguidos");
            SemCpf(corpo, "prompt");
            Assert.DoesNotContain(SenhaSintetica, corpo);
            Assert.DoesNotContain("laudo", corpo, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("F32", corpo);
        }
        return $"{prompts.Count} prompts capturados, nenhum com valor";
    });

    [Fact]
    public Task A09_payload_da_ponte_com_email_nao_sai() => Ataque(
        "A09", "payload para a Ponte Policia com e-mail do cidadao", "a chamada e barrada antes da rede; payload do contrato passa", async () =>
    {
        await using var f = new FabricaDeAtaque();
        _ = f.CreateClient();
        var http = f.Services.GetRequiredService<IHttpClientFactory>().CreateClient();

        var valido = """{"origem_id":"3f2b8c1e-5a4d-4e0b-9c7a-1d2e3f4a5b6c","area_id":"g051_026","ts":"2026-11-14T12:00:00Z","tipo":"roubo_celular","origem_gatilho":"chaveiro"}""";
        Assert.Equal(HttpStatusCode.OK, (await http.PostAsync("http://ponte.invalid/ocorrencias", Json(valido))).StatusCode);
        IEnumerable<(Uri Url, string Corpo)> NaPonte() => f.Rede.Pedidos.Where(p => p.Url.Host == "ponte.invalid");
        Assert.Single(NaPonte());   // controle: o que é do contrato sai

        var ex = await Assert.ThrowsAsync<TaintBloqueadoException>(() =>
            http.PostAsync("http://ponte.invalid/ocorrencias", Json("""{"origem_id":"x","contato":"maria.teste@exemplo.com"}""")));   // SINTETICO
        Assert.Equal(Sink.Ponte, ex.Sink);
        Assert.DoesNotContain("maria.teste", ex.Message);
        await Assert.ThrowsAsync<TaintBloqueadoException>(() =>
            http.PostAsync("http://ponte.invalid/ocorrencias", Json($$"""{"origem_id":"x","documento":"{{Cpf}}"}""")));

        Assert.Single(NaPonte());   // nenhum dos dois chegou à rede
        Assert.DoesNotContain(f.Rede.Pedidos, p => p.Corpo.Contains("maria.teste", StringComparison.Ordinal) || p.Corpo.Contains("982.247", StringComparison.Ordinal));
        Assert.Contains(f.Rastro.Eventos, e => (e.Sink, e.Decisao, e.Classe) == (Sink.Ponte, Decisao.Bloqueado, PiiClasse.Email));
        Assert.Contains(f.Rastro.Eventos, e => (e.Sink, e.Decisao, e.Classe) == (Sink.Ponte, Decisao.Bloqueado, PiiClasse.Cpf));
        return "payload do contrato saiu (1 pedido); com e-mail e com CPF foram barrados, 0 pedidos extras na rede";
    });

    [Fact]
    [Trait("prioridade", "P2")]
    public Task A10_frame_signalr_com_cpf_e_trocado() => Ataque(
        "A10", "frame SignalR com CPF (puro e em fullwidth) saindo do hub", "o frame vira TaintBloqueado, sem o CPF", async () =>
    {
        await using var f = new FabricaDeAtaque();
        _ = f.CreateClient();
        var protocolo = f.Services.GetRequiredService<IEnumerable<IHubProtocol>>().Single();
        Assert.IsType<TaintHubProtocol>(protocolo);

        foreach (var valor in new[] { Cpf, "５２９.９８２.２４７-２５" })
        {
            var msg = new InvocationMessage("AlertaDisparado", new object[] { new { vitimaNome = "Vitima Sintetica", nota = valor } });
            var frame = Encoding.UTF8.GetString(protocolo.GetMessageBytes(msg).ToArray());
            Assert.Contains("TaintBloqueado", frame);
            SemCpf(frame, "frame");
            Assert.DoesNotContain("Vitima Sintetica", frame);
        }
        Assert.True(f.Rastro.Eventos.Count(e => (e.Sink, e.Classe) == (Sink.SignalR, PiiClasse.Cpf)) >= 2);
        return "2 frames sujos trocados por TaintBloqueado, eventos SignalR/Cpf";
    });

    [Fact]
    public Task A11_flag_de_demonstracao_antes_vaza_depois_bloqueia() => Ataque(
        "A11", "flag Cyber:TaintAtivo=false (so vale com AMPARA_DEMO=true)", "antes: log e resposta vazam o CPF; depois: bloqueiam; sem AMPARA_DEMO a flag e ignorada", async () =>
    {
        // ANTES: demonstração com o taint desligado.
        await using (var antes = new FabricaDeAtaque(new() { ["Cyber:TaintAtivo"] = "false" }))
        {
            var c = antes.CreateClient();
            Assert.Equal(HttpStatusCode.NoContent, (await c.GetAsync($"/eco-log?cpf={Cpf}")).StatusCode);
            var (r, corpo) = await PostEco(c, $$"""{"documento":"{{Cpf}}"}""");
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
            Assert.Contains(Cpf, corpo);
            Assert.Contains(antes.Log.Linhas, l => l.Contains(Cpf, StringComparison.Ordinal));
        }

        // DEPOIS: o mesmo ataque com o taint ligado.
        await using (var depois = new FabricaDeAtaque())
        {
            var c = depois.CreateClient();
            Assert.Equal(HttpStatusCode.NoContent, (await c.GetAsync($"/eco-log?cpf={Cpf}")).StatusCode);
            var (r, corpo) = await PostEco(c, $$"""{"documento":"{{Cpf}}"}""");
            AssertBloqueioProblem(r, corpo);
            SemCpf(corpo, "corpo");
            SemCpfNoLog(depois);
        }

        // Fora da demonstração a flag não desliga nada.
        await using (var producao = new FabricaDeAtaque(new() { ["AMPARA_DEMO"] = "false", ["Cyber:TaintAtivo"] = "false" }))
        {
            var c = producao.CreateClient();
            Assert.Equal(HttpStatusCode.NoContent, (await c.GetAsync($"/eco-log?cpf={Cpf}")).StatusCode);
            var (r, corpo) = await PostEco(c, $$"""{"documento":"{{Cpf}}"}""");
            AssertBloqueioProblem(r, corpo);
            SemCpfNoLog(producao);
        }
        return "antes: 200 com CPF na resposta e no log; depois: 500 bloqueado e log limpo; sem demo a flag e ignorada";
    });

    [Fact]
    public Task A12_cinquenta_requisicoes_paralelas_nao_misturam_taint() => Ataque(
        "A12", "50 POSTs simultaneos em /eco anonimo, CPFs distintos", "50 respostas bloqueadas, 50 eventos com 50 CorrelationIds distintos, sem mistura", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var c = f.CreateClient();
        var cpfs = Enumerable.Range(0, 50).Select(CpfSinteticoValido).ToList();
        Assert.Equal(50, cpfs.Distinct().Count());

        var respostas = await Task.WhenAll(cpfs.Select(async cpf =>
        {
            var r = await c.PostAsync("/eco", Json($$"""{"documento":"{{cpf}}"}"""));
            return (Cpf: cpf, R: r, Corpo: await r.Content.ReadAsStringAsync());
        }));

        var idsDasRespostas = new HashSet<string>();
        foreach (var (cpf, r, corpo) in respostas)
        {
            AssertBloqueioProblem(r, corpo);
            foreach (var outro in cpfs)
            {
                Assert.DoesNotContain(outro, corpo);
                Assert.DoesNotContain(new string(outro.Where(char.IsDigit).ToArray()), corpo);
            }
            idsDasRespostas.Add(JsonDocument.Parse(corpo).RootElement.GetProperty("correlationId").GetString()!);
        }
        Assert.Equal(50, idsDasRespostas.Count);

        var eventos = f.Rastro.Eventos.Where(e => (e.Sink, e.Classe, e.Decisao) == (Sink.HttpNaoAutenticada, PiiClasse.Cpf, Decisao.Bloqueado)).ToList();
        Assert.Equal(50, eventos.Count);
        Assert.Equal(50, eventos.Select(e => e.CorrelationId).Distinct().Count());
        Assert.Equal(idsDasRespostas, eventos.Select(e => e.CorrelationId).ToHashSet());   // cada evento pertence à resposta que o gerou

        // O evento nunca guarda valor: nenhum dos 50 CPFs aparece no rastro serializado nem no log.
        var rastroTexto = JsonSerializer.Serialize(f.Rastro.Eventos, new JsonSerializerOptions { IncludeFields = true });
        foreach (var cpf in cpfs)
        {
            Assert.DoesNotContain(cpf, rastroTexto);
            Assert.DoesNotContain(cpf, string.Join("\n", f.Log.Linhas));
        }
        return "50 respostas 500 problem+json, 50 eventos, 50 CorrelationIds distintos e casados com as respostas";
    });

    // CPF válido (dígitos verificadores corretos) a partir de uma semente; formatado ###.###.###-##.
    private static string CpfSinteticoValido(int semente)
    {
        var d = new int[11];
        var n = 123456 + semente * 7919;   // 9 dígitos distintos por semente
        for (var i = 8; i >= 0; i--) { d[i] = n % 10; n /= 10; }
        d[0] = 1 + (d[0] % 9);
        for (var k = 9; k <= 10; k++)
        {
            var soma = 0;
            for (var i = 0; i < k; i++) soma += d[i] * (k + 1 - i);
            var resto = soma * 10 % 11;
            d[k] = resto == 10 ? 0 : resto;
        }
        var s = string.Concat(d);
        return $"{s[..3]}.{s[3..6]}.{s[6..9]}-{s[9..]}";
    }

    [Fact]
    public Task A13_entrada_hostil_json_fundo_corpo_gigante_json_invalido() => Ataque(
        "A13", "JSON com 200 niveis, corpo de 2 MiB (com e sem Content-Length), JSON invalido", "400, 413, 413, 400; passagem do JSON normal; nenhum 500 nem texto tecnico", async () =>
    {
        await using var f = new FabricaDeAtaque();
        var c = f.CreateClient();
        var tecnicos = new[] { "Exception", "StackTrace", "   at ", "Microsoft.", "System.", "Newtonsoft", "Npgsql" };
        async Task<(HttpStatusCode Status, string Corpo)> Enviar(HttpContent conteudo)
        {
            var r = await c.PostAsync("/api/v1/auth/login", conteudo);
            var corpo = await r.Content.ReadAsStringAsync();
            Assert.True((int)r.StatusCode < 500, $"status {(int)r.StatusCode}");
            foreach (var t in tecnicos) Assert.DoesNotContain(t, corpo);
            return (r.StatusCode, corpo);
        }

        var fundo = await Enviar(Json(new string('[', 200) + new string(']', 200)));
        Assert.Equal(HttpStatusCode.BadRequest, fundo.Status);
        Assert.Contains("json-profundo", fundo.Corpo);

        var gigante = await Enviar(Json("{\"email\":\"" + new string('a', 2 * 1024 * 1024) + "\"}"));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, gigante.Status);
        Assert.Contains("corpo-grande", gigante.Corpo);

        var semTamanho = await Enviar(new CorpoSemTamanho(2 * 1024 * 1024));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, semTamanho.Status);

        var invalido = await Enviar(Json("{nao e json"));
        Assert.Equal(HttpStatusCode.BadRequest, invalido.Status);

        var normal = await Enviar(Json("""{"email":"ninguem@ampara.demo","senha":"senha-sintetica-1"}"""));
        Assert.Equal(HttpStatusCode.Unauthorized, normal.Status);
        Assert.NotEqual(HttpStatusCode.RequestEntityTooLarge, normal.Status);
        Assert.NotEqual(HttpStatusCode.BadRequest, normal.Status);   // chegou ao endpoint: 401 de credencial, não bloqueio do pipeline
        return $"profundo {(int)fundo.Status}, gigante {(int)gigante.Status}, gigante sem tamanho {(int)semTamanho.Status}, invalido {(int)invalido.Status}, normal {(int)normal.Status}";
    });

    /// <summary>Corpo em streaming sem Content-Length (chunked): o limite tem de valer pelo que foi lido, não pelo cabeçalho.</summary>
    private sealed class CorpoSemTamanho : HttpContent
    {
        private readonly int _bytes;
        public CorpoSemTamanho(int bytes) { _bytes = bytes; Headers.ContentType = new MediaTypeHeaderValue("application/json"); }

        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context)
        {
            await stream.WriteAsync(Encoding.UTF8.GetBytes("{\"email\":\""));
            var bloco = Encoding.UTF8.GetBytes(new string('a', 64 * 1024));
            for (var enviado = 0; enviado < _bytes; enviado += bloco.Length) await stream.WriteAsync(bloco);
            await stream.WriteAsync(Encoding.UTF8.GetBytes("\"}"));
        }

        protected override bool TryComputeLength(out long length) { length = -1; return false; }
    }
}

/// <summary>Revisao final do plano 03 (entrega-4): o exemplo versionado nao muda de uma execucao para outra.</summary>
public class ExemploVersionadoTests
{
    private static string Corpo() => "{\n  \"status\": 500,\n  \"correlationId\": \"" + Guid.NewGuid() + "\",\n  \"x\": 1\n}";

    [Fact]
    public void Correlation_id_vira_marcador_fixo_no_exemplo()
    {
        var a = ResumoAtaques.FixarCorrelacao(Corpo());
        Assert.Equal(a, ResumoAtaques.FixarCorrelacao(Corpo()));
        Assert.Contains("\"correlationId\": \"" + ResumoAtaques.MarcadorCorrelacao + "\"", a);
        Assert.Contains("\"x\": 1", a);
    }
}
