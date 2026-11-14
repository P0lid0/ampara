using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Application.Risco;
using Ampara.Infrastructure.Risco;
using Ampara.Tests.Infra;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Tests;

public class RiscoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Cab = "area_id,lat,lng,dia_semana,faixa,classe,prob_alto\n";
    private static readonly string Fixture = Path.Combine(AppContext.BaseDirectory, "Fixtures", "risco-teste.csv");
    private const string Bbox = "minLat=-23.58&minLng=-46.71&maxLat=-23.56&maxLng=-46.69";

    private static string Temp(string conteudo)
    {
        var p = Path.Combine(Path.GetTempPath(), $"risco-{Guid.NewGuid():N}.csv");
        File.WriteAllText(p, conteudo);
        return p;
    }

    [Fact]
    public void Importa_e_consulta_por_bbox_dia_e_faixa()
    {
        var svc = new RiscoService();
        svc.Importar(Fixture);
        var r = svc.Consultar(-23.58, -46.71, -23.56, -46.69, 5, 6);
        var c = Assert.Single(r);
        Assert.Equal(("g051_026", "alto", 0.8123), (c.AreaId, c.Classe, c.ProbAlto));
        Assert.Equal("alto", svc.ClasseDe("g051_026", 5, 6));
        Assert.Equal("medio", svc.ClasseDe("g051_026", 5, 2));
        Assert.Null(svc.ClasseDe("g051_026", 0, 0));
        Assert.Empty(svc.Consultar(-23.58, -46.71, -23.56, -46.69, 5, 3));
    }

    [Theory]
    [InlineData("cabecalho,errado\n")]
    [InlineData(Cab + "g051_026,-23.5,-46.7,5,6,critico,0.5\n")]
    [InlineData(Cab + "g051_026,-23.5,-46.7,5,6,alto,1.5\n")]
    [InlineData(Cab + "xx,-23.5,-46.7,5,6,alto,0.5\n")]
    [InlineData(Cab + "g051_026,-23.5,-46.7,7,6,alto,0.5\n")]
    [InlineData(Cab + "g051_026,-23.5,-46.7,5,8,alto,0.5\n")]
    [InlineData(Cab + "g051_026,-23,5,-46.7,5,6,alto,0.5\n")]
    [InlineData(Cab + "g051_026,-23.5,-46.7,5,6,alto,0.5\ng051_026,-23.5,-46.7,5,6,medio,0.2\n")]
    public void Arquivo_invalido_falha_e_nao_troca_o_snapshot(string conteudo)
    {
        var svc = new RiscoService();
        svc.Importar(Fixture);
        var e = Assert.Throws<DominioException>(() => svc.Importar(Temp(conteudo)));
        Assert.Equal("risco-csv-invalido", e.Codigo);
        Assert.NotEmpty(svc.Consultar(-23.58, -46.71, -23.56, -46.69, 5, 6));
    }

    [Fact]
    public void Arquivo_ausente_falha_com_o_mesmo_codigo()
    {
        var e = Assert.Throws<DominioException>(() => new RiscoService().Importar(Path.Combine(Path.GetTempPath(), "nao-existe.csv")));
        Assert.Equal("risco-csv-invalido", e.Codigo);
    }

    [Fact]
    public async Task Inicializador_com_arquivo_ausente_nao_derruba_a_subida()
    {
        var svc = new RiscoService();
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RISCO_CSV"] = "nao-existe.csv" }).Build();
        await new RiscoInicializador(svc, cfg, NullLogger<RiscoInicializador>.Instance).StartAsync(CancellationToken.None);
        Assert.Empty(svc.Consultar(-90, -180, 90, 180, 5, 6));
    }

    [Fact]
    public async Task Inicializador_importa_o_RISCO_CSV()
    {
        var svc = new RiscoService();
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RISCO_CSV"] = Fixture }).Build();
        await new RiscoInicializador(svc, cfg, NullLogger<RiscoInicializador>.Instance).StartAsync(CancellationToken.None);
        Assert.Equal("alto", svc.ClasseDe("g051_026", 5, 6));
    }

    [Fact]
    public async Task Rota_risco_responde_camelCase()
    {
        f.Services.GetRequiredService<IRiscoService>().Importar(Fixture);
        var r = await f.CreateClient().GetAsync($"/api/v1/risco?{Bbox}&dia=5&faixa=6");   // anônima
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var itens = (await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        var i = Assert.Single(itens);
        Assert.Equal(["areaId", "classe", "lat", "lng", "probAlto"], i.EnumerateObject().Select(p => p.Name).Order().ToArray());
        Assert.Equal("g051_026", i.GetProperty("areaId").GetString());
        Assert.Equal("alto", i.GetProperty("classe").GetString());
        Assert.Equal(0.8123, i.GetProperty("probAlto").GetDouble());
    }

    [Theory]
    [InlineData("minLng=-46.71&maxLat=-23.56&maxLng=-46.69&dia=5&faixa=6")]                                       // sem minLat
    [InlineData("minLat=-23.56&minLng=-46.71&maxLat=-23.58&maxLng=-46.69&dia=5&faixa=6")]                         // min > max
    [InlineData("minLat=-23.58&minLng=-46.71&maxLat=-23.58&maxLng=-46.69&dia=5&faixa=6")]                         // min == max
    [InlineData("minLat=abc&minLng=-46.71&maxLat=-23.56&maxLng=-46.69&dia=5&faixa=6")]                            // nao numerico
    [InlineData("minLat=-23.58&minLng=-46.71&maxLat=-23.56&maxLng=-46.69&dia=5&faixa=9")]                         // faixa fora
    [InlineData("minLat=-23.58&minLng=-46.71&maxLat=-23.56&maxLng=-46.69&dia=7&faixa=6")]                         // dia fora
    [InlineData("minLat=-23.58&minLng=-46.71&maxLat=-23.56&maxLng=-46.69&dia=-1&faixa=6")]                        // dia negativo
    public async Task Rota_exige_bbox_valida_e_dia_faixa_no_intervalo(string consulta)
    {
        var r = await f.CreateClient().GetAsync("/api/v1/risco?" + consulta);
        Assert.Equal((HttpStatusCode)422, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Sem_dia_e_faixa_usa_agora_em_hora_de_sao_paulo()
    {
        f.Services.GetRequiredService<IRiscoService>().Importar(Fixture);
        // O relogio da fabrica so avanca; esta classe tem fabrica propria e os demais testes passam dia/faixa explicitos.
        f.Tempo.SetUtcNow(new DateTimeOffset(2026, 11, 14, 21, 42, 0, TimeSpan.Zero));   // sabado 18:42 em SP: dia 5, faixa 6
        var r = await f.CreateClient().GetAsync($"/api/v1/risco?{Bbox}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var i = Assert.Single((await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList());
        Assert.Equal("g051_026", i.GetProperty("areaId").GetString());
    }
}
