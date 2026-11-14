using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Relatos;
using Ampara.Application.Risco;
using Ampara.Domain.Comum;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class RelatoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    // Area sem linha de risco na maior parte do tempo (g010_010 so tem linha no sabado faixa 6, como "baixo").
    private const double LatBaixa = -23.75275, LngBaixa = -46.77855;
    private const string BBoxBaixa = "minLat=-23.76&minLng=-46.79&maxLat=-23.74&maxLng=-46.77";

    // Os workers nao rodam na fabrica de testes, entao o risco sintetico e importado aqui (singleton, idempotente).
    private readonly bool _riscoImportado = Importar(f);

    private static bool Importar(AmparaFactory f)
    {
        f.Services.GetRequiredService<IRiscoService>().Importar(Path.Combine(AppContext.BaseDirectory, "Fixtures", "risco-teste.csv"));
        return true;
    }

    private static string Iso(DateTime d) => d.ToUniversalTime().ToString("O");

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    private async Task<Guid> CriarAsync(Sessao s, double lat = LatBaixa, double lng = LngBaixa, DateTime? em = null, string tipo = "roubo", string? texto = null)
    {
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/relatos", new { tipo, lat, lng, em = Iso(em ?? f.Tempo.GetUtcNow().UtcDateTime.AddMinutes(-1)), texto });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("relatoId").GetGuid();
    }

    private static async Task<List<JsonElement>> ListarAsync(Sessao s, string bbox)
    {
        var r = await s.Cliente.GetAsync($"/api/v1/relatos?{bbox}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
    }

    /// <summary>Caixa minuscula em volta de um ponto, para isolar o relato do teste dos demais.</summary>
    private static string Caixa(double lat, double lng) =>
        FormattableString.Invariant($"minLat={lat - 0.0001}&minLng={lng - 0.0001}&maxLat={lat + 0.0001}&maxLng={lng + 0.0001}");

    /// <summary>Anda o relogio ate sabado (dia 5) na faixa 6 (18h-21h em Sao Paulo), onde g051_026 e "alto".</summary>
    private void IrParaSabadoFaixa6()
    {
        for (var i = 0; i < 24 * 7; i++)
        {
            var t = f.Tempo.GetUtcNow().UtcDateTime;
            if (AreaMapa.DiaSemana(t) == 5 && AreaMapa.Faixa(t) == 6) return;
            f.Tempo.Advance(TimeSpan.FromHours(1));
        }
        Assert.Fail("nao chegou ao sabado faixa 6");
    }

    [Fact]
    public async Task Relato_sozinho_em_area_baixa_fica_oculto_e_com_segunda_confirmacao_aparece()
    {
        var autor = await f.NovoUsuarioAsync();
        var outro = await f.NovoUsuarioAsync();
        var lat = LatBaixa + 0.0011; var lng = LngBaixa + 0.0011;
        var id = await CriarAsync(autor, lat, lng);
        Assert.Empty(await ListarAsync(autor, Caixa(lat, lng)));

        Assert.Equal(HttpStatusCode.NoContent, (await outro.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null)).StatusCode);
        var item = Assert.Single(await ListarAsync(autor, Caixa(lat, lng)));
        Assert.Equal(id, item.GetProperty("id").GetGuid());
        Assert.Equal(2, item.GetProperty("confirmacoes").GetInt32());
    }

    [Fact]
    public async Task Lista_traz_exatamente_id_tipo_lat_lng_em_confirmacoes()
    {
        var autor = await f.NovoUsuarioAsync();
        var outro = await f.NovoUsuarioAsync();
        var lat = LatBaixa + 0.0021; var lng = LngBaixa + 0.0021;
        var id = await CriarAsync(autor, lat, lng, tipo: "furto", texto: "pessoa de camisa azul");
        await outro.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null);

        var item = Assert.Single(await ListarAsync(outro, Caixa(lat, lng)));
        var chaves = item.EnumerateObject().Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        Assert.Equal(new[] { "confirmacoes", "em", "id", "lat", "lng", "tipo" }, chaves);
        Assert.Equal("furto", item.GetProperty("tipo").GetString());
        Assert.EndsWith("Z", item.GetProperty("em").GetString());
        Assert.Equal(lat, item.GetProperty("lat").GetDouble());
        var bruto = item.GetRawText();
        Assert.DoesNotContain(autor.UsuarioId.ToString(), bruto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("camisa", bruto);
    }

    [Fact]
    public async Task Em_area_de_risco_alto_aparece_sozinho()
    {
        IrParaSabadoFaixa6();
        var autor = await f.NovoUsuarioAsync();
        var (lat, lng) = AreaMapa.Centro("g051_026")!.Value;
        var id = await CriarAsync(autor, lat, lng);
        var item = Assert.Single(await ListarAsync(autor, Caixa(lat, lng)));
        Assert.Equal(id, item.GetProperty("id").GetGuid());
        Assert.Equal(1, item.GetProperty("confirmacoes").GetInt32());
    }

    [Fact]
    public async Task Confirmar_duas_vezes_ou_o_proprio_autor_nao_soma()
    {
        var autor = await f.NovoUsuarioAsync();
        var outro = await f.NovoUsuarioAsync();
        var id = await CriarAsync(autor, LatBaixa + 0.0031, LngBaixa + 0.0031);
        Assert.Equal(HttpStatusCode.NoContent, (await autor.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await autor.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null)).StatusCode);
        using (var db = f.NovoDb()) Assert.Equal(1, db.RelatoConfirmacoes.Count(c => c.RelatoId == id));

        Assert.Equal(HttpStatusCode.NoContent, (await outro.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await outro.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null)).StatusCode);
        using (var db = f.NovoDb()) Assert.Equal(2, db.RelatoConfirmacoes.Count(c => c.RelatoId == id));
    }

    [Fact]
    public async Task Confirmar_relato_inexistente_404()
    {
        var s = await f.NovoUsuarioAsync();
        var r = await s.Cliente.PostAsync($"/api/v1/relatos/{Guid.NewGuid()}/confirmar", null);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Expira_apos_duas_horas_e_a_purga_remove()
    {
        var autor = await f.NovoUsuarioAsync();
        var outro = await f.NovoUsuarioAsync();
        var lat = LatBaixa + 0.0041; var lng = LngBaixa + 0.0041;
        var id = await CriarAsync(autor, lat, lng);
        await outro.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null);
        Assert.Single(await ListarAsync(autor, Caixa(lat, lng)));

        f.Tempo.Advance(TimeSpan.FromHours(2) + TimeSpan.FromMinutes(1));   // o relato foi feito 1 min antes de "agora"
        Assert.Empty(await ListarAsync(autor, Caixa(lat, lng)));
        var recente = await CriarAsync(autor, lat, lng);   // relato novo: nao pode ser purgado

        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IRelatoService>();
        Assert.True(await svc.PurgarExpiradosAsync(CancellationToken.None) >= 1);
        using var db = f.NovoDb();
        Assert.Single(db.Relatos.Where(r => r.Id == recente));   // o recente sobrevive
        Assert.Empty(db.Relatos.Where(r => r.Id == id));
        Assert.Empty(db.RelatoConfirmacoes.Where(c => c.RelatoId == id));   // confirmacoes vao junto
    }

    [Fact]
    public async Task Em_invalido_ou_fora_do_mapa_422()
    {
        var s = await f.NovoUsuarioAsync();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;

        async Task<HttpResponseMessage> Enviar(double lat, double lng, DateTime em, string tipo = "roubo") =>
            await s.Cliente.PostAsJsonAsync("/api/v1/relatos", new { tipo, lat, lng, em = Iso(em) });

        var futuro = await Enviar(LatBaixa, LngBaixa, agora.AddMinutes(6));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, futuro.StatusCode);
        Assert.Equal("relato-fora-da-janela", await CodigoDoErroAsync(futuro));

        var antigo = await Enviar(LatBaixa, LngBaixa, agora.AddHours(-2).AddSeconds(-1));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, antigo.StatusCode);
        Assert.Equal("relato-fora-da-janela", await CodigoDoErroAsync(antigo));

        var fora = await Enviar(-10.0, -50.0, agora);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, fora.StatusCode);

        var tipoRuim = await Enviar(LatBaixa, LngBaixa, agora, "homicidio");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, tipoRuim.StatusCode);

        // 4 minutos no futuro ainda cabe na tolerancia de 5 min.
        Assert.Equal(HttpStatusCode.Created, (await Enviar(LatBaixa, LngBaixa, agora.AddMinutes(4))).StatusCode);
    }

    [Fact]
    public async Task Sexto_relato_na_hora_429()
    {
        var s = await f.NovoUsuarioAsync();
        for (var i = 0; i < 5; i++) await CriarAsync(s);
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/relatos", new { tipo = "roubo", lat = LatBaixa, lng = LngBaixa, em = Iso(f.Tempo.GetUtcNow().UtcDateTime) });
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.Equal("limite-relatos", await CodigoDoErroAsync(r));
        Assert.True(r.Headers.Contains("Retry-After"));

        // Outro usuario nao e afetado; e passada 1 hora o autor volta a poder relatar.
        var outro = await f.NovoUsuarioAsync();
        await CriarAsync(outro);
        f.Tempo.Advance(TimeSpan.FromMinutes(61));
        await CriarAsync(s);
    }

    [Fact]
    public async Task Texto_livre_nao_e_gravado_nem_devolvido_ate_o_plano_03()
    {
        var autor = await f.NovoUsuarioAsync();
        var lat = LatBaixa + 0.0051; var lng = LngBaixa + 0.0051;
        var id = await CriarAsync(autor, lat, lng, texto: "pessoa de camisa azul");
        using (var db = f.NovoDb()) Assert.Null(db.Relatos.Single(r => r.Id == id).Texto);

        var outro = await f.NovoUsuarioAsync();
        await outro.Cliente.PostAsync($"/api/v1/relatos/{id}/confirmar", null);
        var item = Assert.Single(await ListarAsync(autor, Caixa(lat, lng)));
        Assert.False(item.TryGetProperty("texto", out _));
    }

    [Theory]
    [InlineData("")]
    [InlineData("minLat=-23.8&minLng=-46.8&maxLat=-23.4")]
    [InlineData("minLat=-23.4&minLng=-46.8&maxLat=-23.8&maxLng=-46.4")]
    [InlineData("minLat=abc&minLng=-46.8&maxLat=-23.4&maxLng=-46.4")]
    public async Task Lista_sem_bbox_valida_422(string bbox)
    {
        var s = await f.NovoUsuarioAsync();
        var r = await s.Cliente.GetAsync($"/api/v1/relatos?{bbox}");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
    }

    [Fact]
    public async Task Rotas_exigem_usuario()
    {
        var anonimo = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.GetAsync($"/api/v1/relatos?{BBoxBaixa}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsync($"/api/v1/relatos/{Guid.NewGuid()}/confirmar", null)).StatusCode);
    }
}
