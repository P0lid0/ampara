using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Domain.Entidades;
using Ampara.Tests.Infra;

namespace Ampara.Tests;

public class GuardiaoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static async Task<string> NovoConviteAsync(Sessao v)
    {
        var r = await v.Cliente.PostAsync("/api/v1/guardioes/convites", null);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    private static Task<HttpResponseMessage> AceitarAsync(Sessao g, string codigo) =>
        g.Cliente.PostAsync($"/api/v1/guardioes/convites/{codigo}/aceitar", null);

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        var corpo = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(corpo.TryGetProperty("detalheCidadao", out _));
        return corpo.GetProperty("codigo").GetString()!;
    }

    [Fact]
    public async Task Convite_aceito_vira_guardiao_com_ordem()
    {
        var v = await f.NovoUsuarioAsync("Vitima Teste"); var g = await f.NovoUsuarioAsync("Guardiao Um");
        var cv = await (await v.Cliente.PostAsync("/api/v1/guardioes/convites", null)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Matches("^[A-HJ-NP-Z2-9]{6}$", cv.GetProperty("codigo").GetString()!);
        Assert.Equal(HttpStatusCode.NoContent, (await g.Cliente.PostAsync($"/api/v1/guardioes/convites/{cv.GetProperty("codigo").GetString()}/aceitar", null)).StatusCode);
        var lista = await v.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/guardioes");
        Assert.Equal(1, lista[0].GetProperty("ordem").GetInt32());
        Assert.Equal("Guardiao Um", lista[0].GetProperty("nome").GetString());
    }

    [Fact]
    public async Task Convite_invalido_404_vencido_410_e_limite_409()
    {
        var v = await f.NovoUsuarioAsync("Vitima Limite");
        var u = await f.NovoUsuarioAsync();

        var r404 = await AceitarAsync(u, "ZZZZZZ");
        Assert.Equal(HttpStatusCode.NotFound, r404.StatusCode);
        Assert.Equal("convite-invalido", await CodigoDoErroAsync(r404));

        // Convite ja usado.
        var usado = await NovoConviteAsync(v);
        Assert.Equal(HttpStatusCode.NoContent, (await AceitarAsync(u, usado)).StatusCode);
        var r2 = await AceitarAsync(await f.NovoUsuarioAsync(), usado);
        Assert.Equal(HttpStatusCode.NotFound, r2.StatusCode);
        Assert.Equal("convite-invalido", await CodigoDoErroAsync(r2));

        // Limite: 3 guardioes e um convite ainda valido (inserido direto: pela API o limite ja o impediria).
        await f.VincularGuardiaoAsync(v);
        await f.VincularGuardiaoAsync(v);
        using (var db = f.NovoDb())
        {
            db.Convites.Add(Convite.Criar(v.UsuarioId, "LIMITE", f.Tempo.GetUtcNow().UtcDateTime));
            await db.SaveChangesAsync();
        }
        var r409 = await AceitarAsync(await f.NovoUsuarioAsync(), "LIMITE");
        Assert.Equal(HttpStatusCode.Conflict, r409.StatusCode);
        Assert.Equal("limite-guardioes", await CodigoDoErroAsync(r409));

        // Vencido: por ultimo, porque avanca o relogio compartilhado.
        var outra = await f.NovoUsuarioAsync("Vitima Vencida");
        var codigo = await NovoConviteAsync(outra);
        f.Tempo.Advance(TimeSpan.FromHours(25));
        var aceitante = await f.NovoUsuarioAsync();   // depois do avanco: o token anterior ja teria vencido
        var r410 = await AceitarAsync(aceitante, codigo);
        Assert.Equal(HttpStatusCode.Gone, r410.StatusCode);
        Assert.Equal("convite-vencido", await CodigoDoErroAsync(r410));
    }

    [Fact]
    public async Task Aceitar_o_proprio_convite_422()
    {
        var v = await f.NovoUsuarioAsync("Vitima Propria");
        var codigo = await NovoConviteAsync(v);
        var r = await AceitarAsync(v, codigo);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
        Assert.Equal("convite-proprio", await CodigoDoErroAsync(r));
    }

    [Fact]
    public async Task Quarto_convite_com_tres_guardioes_409()
    {
        var v = await f.NovoUsuarioAsync("Vitima Quarto");
        for (var i = 0; i < 3; i++) await f.VincularGuardiaoAsync(v);
        var r = await v.Cliente.PostAsync("/api/v1/guardioes/convites", null);
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("limite-guardioes", await CodigoDoErroAsync(r));
    }

    [Fact]
    public async Task Convites_pendentes_contam_para_o_limite()
    {
        var v = await f.NovoUsuarioAsync("Vitima Pendente");
        await f.VincularGuardiaoAsync(v);
        await NovoConviteAsync(v);
        await NovoConviteAsync(v);
        var r = await v.Cliente.PostAsync("/api/v1/guardioes/convites", null);
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
    }

    [Fact]
    public async Task Mesmo_guardiao_nao_entra_duas_vezes()
    {
        var v = await f.NovoUsuarioAsync("Vitima Repetida");
        var g = await f.VincularGuardiaoAsync(v);
        var r = await AceitarAsync(g, await NovoConviteAsync(v));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("guardiao-ja-vinculado", await CodigoDoErroAsync(r));
    }

    [Fact]
    public async Task Reordena_e_rejeita_ordem_invalida()
    {
        var v = await f.NovoUsuarioAsync("Vitima Ordem");
        for (var i = 0; i < 3; i++) await f.VincularGuardiaoAsync(v);
        var ids = (await v.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/guardioes")).EnumerateArray()
            .Select(x => x.GetProperty("guardiaoId").GetGuid()).ToList();

        var troca = new[] { ids[1], ids[0], ids[2] };
        Assert.Equal(HttpStatusCode.NoContent, (await v.Cliente.PutAsJsonAsync("/api/v1/guardioes/ordem", new { ordem = troca })).StatusCode);
        var depois = (await v.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/guardioes")).EnumerateArray()
            .Select(x => x.GetProperty("guardiaoId").GetGuid()).ToList();
        Assert.Equal(troca, depois);

        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await v.Cliente.PutAsJsonAsync("/api/v1/guardioes/ordem", new { ordem = new[] { ids[0], ids[1], Guid.NewGuid() } })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await v.Cliente.PutAsJsonAsync("/api/v1/guardioes/ordem", new { ordem = new[] { ids[0], ids[1] } })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await v.Cliente.PutAsJsonAsync("/api/v1/guardioes/ordem", new { ordem = new[] { ids[0], ids[0], ids[1] } })).StatusCode);
    }

    [Fact]
    public async Task Rotas_exigem_escopo_usuario()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/guardioes")).StatusCode);
    }

    [Fact]
    public void PodeEscalar_exclui_ja_acionados()
    {
        var g = new Guardiao { Id = Guid.NewGuid() };
        Assert.True(g.PodeEscalar([]));
        Assert.False(g.PodeEscalar([g.Id]));
    }

    [Fact]
    public void Convite_vale_24h_e_uso_unico()
    {
        var agora = new DateTime(2026, 11, 14, 12, 0, 0, DateTimeKind.Utc);
        var c = Convite.Criar(Guid.NewGuid(), "ABC234", agora);
        Assert.Equal(agora.AddHours(24), c.ExpiraEm);
        Assert.True(c.Valido(agora.AddHours(23)));
        Assert.False(c.Valido(agora.AddHours(24)));
        c.Usar(agora);
        Assert.False(c.Valido(agora));
    }
}
