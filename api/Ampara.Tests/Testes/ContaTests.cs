using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class ContaTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    [Fact]
    public async Task Catalogo_anonimo_lista_bancos_e_operadoras()
    {
        var r = await f.CreateClient().GetAsync("/api/v1/contas/catalogo");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var itens = (await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Contains(itens, i => i.GetProperty("tipo").GetString() == "banco");
        Assert.Contains(itens, i => i.GetProperty("tipo").GetString() == "operadora");
        foreach (var campo in new[] { "id", "nome", "tipo", "telefone", "link", "conferidoEm" })
            Assert.All(itens, i => Assert.True(i.TryGetProperty(campo, out _), campo));
    }

    [Fact]
    public async Task Vincula_conta_cifrada()
    {
        var s = await f.NovoUsuarioAsync();
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "nubank" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var id = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("contaId").GetGuid();
        using var db = f.NovoDb();
        var c = db.Contas.Single(x => x.UsuarioId == s.UsuarioId);
        Assert.Equal(id, c.Id);
        Assert.NotEqual("nubank", c.CatalogoIdCifrado);
        Assert.DoesNotContain("nubank", c.CatalogoIdCifrado);
        Assert.Equal("nubank", f.Services.GetRequiredService<ICifrador>().Decifrar(c.CatalogoIdCifrado));
    }

    [Fact]
    public async Task Conta_desconhecida_404_e_duplicada_409()
    {
        var s = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "nao-existe" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "itau" })).StatusCode);
        var dup = await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "itau" });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
        Assert.Equal("conta-ja-vinculada", (await dup.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
        using var db = f.NovoDb();
        Assert.Single(db.Contas.Where(x => x.UsuarioId == s.UsuarioId));
        // outro usuario pode vincular a mesma instituicao
        var outro = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.Created, (await outro.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "itau" })).StatusCode);
    }

    [Fact]
    public async Task Lista_so_as_contas_do_dono_com_telefone_e_link_do_catalogo()
    {
        var s = await f.NovoUsuarioAsync();
        var outro = await f.NovoUsuarioAsync();
        var idA = (await (await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "nubank" })).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("contaId").GetGuid();
        var idB = (await (await s.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "vivo" })).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("contaId").GetGuid();
        await outro.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "itau" });

        var r = await s.Cliente.GetAsync("/api/v1/contas");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var corpo = await r.Content.ReadAsStringAsync();
        var itens = JsonDocument.Parse(corpo).RootElement.EnumerateArray().ToList();
        Assert.Equal(2, itens.Count);
        Assert.Equal(new[] { idA, idB }.Order(), itens.Select(i => i.GetProperty("id").GetGuid()).Order());
        Assert.All(itens, i =>
        {
            foreach (var campo in new[] { "id", "nome", "tipo", "telefone", "link" }) Assert.True(i.TryGetProperty(campo, out _), campo);
            Assert.False(i.TryGetProperty("catalogoId", out _));
            Assert.False(i.TryGetProperty("conferidoEm", out _));
        });
        var nu = itens.Single(i => i.GetProperty("id").GetGuid() == idA);
        Assert.Equal("4020 0185", nu.GetProperty("telefone").GetString());
        Assert.Equal("https://exemplo.invalid/a", nu.GetProperty("link").GetString());
        using var db = f.NovoDb();
        foreach (var c in db.Contas.Where(x => x.UsuarioId == s.UsuarioId).ToList()) Assert.DoesNotContain(c.CatalogoIdCifrado, corpo);

        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/contas")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().PostAsJsonAsync("/api/v1/contas", new { catalogoId = "nubank" })).StatusCode);
    }
}
