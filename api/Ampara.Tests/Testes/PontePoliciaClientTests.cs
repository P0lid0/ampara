using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Ampara.Application.Comum;
using Ampara.Application.Policia;
using Ampara.Domain.Comum;
using Ampara.Infrastructure.Ponte;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class PontePoliciaClientTests
{
    private const string Chave = "chave-teste-sintetica";   // SINTETICO
    private static readonly string[] ChavesDoContrato = ["origem_id", "area_id", "ts", "tipo", "origem_gatilho", "device_hash", "trilha"];

    private sealed class Capturador(Func<HttpRequestMessage, Task<HttpResponseMessage>> responder) : HttpMessageHandler
    {
        public List<(HttpMethod Metodo, string Caminho, string? Chave, string? Corpo)> Chamadas { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var corpo = req.Content is null ? null : await req.Content.ReadAsStringAsync(ct);
            req.Headers.TryGetValues("X-Chave-Servico", out var chave);
            Chamadas.Add((req.Method, req.RequestUri!.AbsolutePath, chave?.SingleOrDefault(), corpo));
            return await responder(req);
        }
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string corpo) =>
        new(status) { Content = new StringContent(corpo, Encoding.UTF8, "application/json") };

    // Usa o mesmo registro de produção (base, timeout, cabeçalho) e troca só o handler primário.
    private static IPontePoliciaClient Cliente(Capturador h)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["PONTE_URL"] = "http://ponte.invalid:8000",
            ["PONTE_CHAVE_SERVICO"] = Chave,
        }).Build();
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(cfg);
        services.AddPontePolicia();
        services.AddHttpClient<IPontePoliciaClient, PontePoliciaClient>().ConfigurePrimaryHttpMessageHandler(() => h);
        return services.BuildServiceProvider().GetRequiredService<IPontePoliciaClient>();
    }

    private static readonly Guid OrigemId = Guid.Parse("11111111-2222-3333-4444-555555555555");   // SINTETICO

    private static PonteOcorrencia Exemplo() => new(
        OrigemId, "g051_026", new DateTime(2026, 11, 14, 21, 42, 0, DateTimeKind.Utc), "roubo_celular", "chaveiro",
        DeviceHash.Calcular("chaveiro-ampara-a1b2c3", Chave),
        [new PontoTrilha(-23.5672, -46.7019, new DateTime(2026, 11, 14, 21, 43, 0, DateTimeKind.Utc)),
         new PontoTrilha(-23.5680, -46.7005, new DateTime(2026, 11, 14, 21, 44, 0, DateTimeKind.Utc))]);

    [Fact]
    public async Task Envia_para_POST_ocorrencias_com_chave_e_so_os_campos_do_contrato()
    {
        var h = new Capturador(_ => Task.FromResult(Json(HttpStatusCode.Created, """{"protocolo":"PP-2026-000001","status":"recebida"}""")));
        var r = await Cliente(h).EnviarAsync(Exemplo(), CancellationToken.None);

        Assert.Equal(new PonteProtocolo("PP-2026-000001", "recebida"), r);
        var c = Assert.Single(h.Chamadas);
        Assert.Equal(HttpMethod.Post, c.Metodo);
        Assert.Equal("/ocorrencias", c.Caminho);
        Assert.Equal(Chave, c.Chave);
        var corpo = JsonDocument.Parse(c.Corpo!).RootElement;
        Assert.Equal(ChavesDoContrato.Order(), corpo.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal("2026-11-14T21:42:00Z", corpo.GetProperty("ts").GetString());
        Assert.Equal(OrigemId, corpo.GetProperty("origem_id").GetGuid());
    }

    [Fact]
    public void Payload_nao_tem_propriedade_de_dado_pessoal()
    {
        Assert.DoesNotContain(typeof(PonteOcorrencia).GetProperties(), p => Regex.IsMatch(p.Name, "cpf|nome|email|telefone|imei|senha", RegexOptions.IgnoreCase));
        Assert.DoesNotContain(typeof(PontoTrilha).GetProperties(), p => Regex.IsMatch(p.Name, "cpf|nome|email|telefone|imei|senha", RegexOptions.IgnoreCase));
    }

    [Fact]
    public async Task Respostas_de_erro_viram_ponte_indisponivel()
    {
        foreach (var status in new[] { HttpStatusCode.UnprocessableEntity, HttpStatusCode.InternalServerError, HttpStatusCode.Unauthorized })
        {
            var h = new Capturador(_ => Task.FromResult(Json(status, """{"detail":"x"}""")));
            var ex = await Assert.ThrowsAsync<ServicoIndisponivelException>(() => Cliente(h).EnviarAsync(Exemplo(), CancellationToken.None));
            Assert.Equal("ponte-indisponivel", ex.Codigo);
        }

        // Timeout (TaskCanceledException com o token do chamador intacto) e erro de rede.
        var timeout = new Capturador(_ => throw new TaskCanceledException("timeout"));
        Assert.Equal("ponte-indisponivel", (await Assert.ThrowsAsync<ServicoIndisponivelException>(() => Cliente(timeout).EnviarAsync(Exemplo(), CancellationToken.None))).Codigo);
        var rede = new Capturador(_ => throw new HttpRequestException("sem rota"));
        Assert.Equal("ponte-indisponivel", (await Assert.ThrowsAsync<ServicoIndisponivelException>(() => Cliente(rede).EnviarAsync(Exemplo(), CancellationToken.None))).Codigo);
        var lixo = new Capturador(_ => Task.FromResult(Json(HttpStatusCode.OK, "isto nao e json")));
        Assert.Equal("ponte-indisponivel", (await Assert.ThrowsAsync<ServicoIndisponivelException>(() => Cliente(lixo).EnviarAsync(Exemplo(), CancellationToken.None))).Codigo);
        // O retorno também: só o 404 é "sem retorno"; o resto é indisponível.
        var erro = new Capturador(_ => Task.FromResult(Json(HttpStatusCode.InternalServerError, "{}")));
        await Assert.ThrowsAsync<ServicoIndisponivelException>(() => Cliente(erro).ObterRetornoAsync("PP-2026-000001", CancellationToken.None));
    }

    [Fact]
    public async Task Cancelamento_do_chamador_nao_vira_ponte_indisponivel()
    {
        using var cts = new CancellationTokenSource();
        var h = new Capturador(_ => { cts.Cancel(); throw new TaskCanceledException(); });
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Cliente(h).EnviarAsync(Exemplo(), cts.Token));
    }

    [Fact]
    public async Task Retorno_404_vira_null_e_200_mapeia_snake_case()
    {
        var h404 = new Capturador(_ => Task.FromResult(Json(HttpStatusCode.NotFound, """{"detail":"nao encontrado"}""")));
        Assert.Null(await Cliente(h404).ObterRetornoAsync("PP-2026-000009", CancellationToken.None));

        var h = new Capturador(_ => Task.FromResult(Json(HttpStatusCode.OK,
            """{"protocolo":"PP-2026-000001","status":"em_analise","mensagem":"Em análise.","atualizado_em":"2026-11-14T22:30:00Z"}""")));
        var r = await Cliente(h).ObterRetornoAsync("PP-2026-000001", CancellationToken.None);
        Assert.Equal(new PonteRetorno("PP-2026-000001", "em_analise", "Em análise.", new DateTime(2026, 11, 14, 22, 30, 0, DateTimeKind.Utc)), r);
        Assert.Equal(DateTimeKind.Utc, r!.AtualizadoEm.Kind);
        var c = Assert.Single(h.Chamadas);
        Assert.Equal(HttpMethod.Get, c.Metodo);
        Assert.Equal("/ocorrencias/PP-2026-000001/retorno", c.Caminho);
        Assert.Equal(Chave, c.Chave);
    }

    [Fact]
    public async Task Grava_o_exemplo_serializado_para_o_teste_de_contrato_da_ponte()
    {
        // Mesmo serializador do cliente. Tudo sintético.
        var json = JsonSerializer.Serialize(Exemplo(), PontePoliciaClient.Json);

        var raiz = new DirectoryInfo(AppContext.BaseDirectory);
        while (raiz is not null && !Directory.Exists(Path.Combine(raiz.FullName, "ponte-policia"))) raiz = raiz.Parent;
        Assert.NotNull(raiz);
        var pasta = Path.Combine(raiz.FullName, "ponte-policia", "tests", "contrato");
        Directory.CreateDirectory(pasta);
        var arquivo = Path.Combine(pasta, "exemplo_da_api.json");
        await File.WriteAllTextAsync(arquivo, json, new UTF8Encoding(false));

        var lido = JsonDocument.Parse(await File.ReadAllTextAsync(arquivo)).RootElement;
        Assert.Equal(ChavesDoContrato.Order(), lido.EnumerateObject().Select(p => p.Name).Order());
        Assert.EndsWith("Z", lido.GetProperty("ts").GetString());
        var trilha = lido.GetProperty("trilha").EnumerateArray().ToList();
        Assert.Equal(2, trilha.Count);
        Assert.All(trilha, p => Assert.EndsWith("Z", p.GetProperty("em").GetString()));
        Assert.Matches("^[0-9a-f]{64}$", lido.GetProperty("device_hash").GetString()!);
        Assert.Equal("g051_026", lido.GetProperty("area_id").GetString());
    }
}
