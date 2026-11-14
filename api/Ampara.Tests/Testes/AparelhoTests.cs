using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Application.Aparelhos;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class AparelhoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string ImeiA = "490154203237518";   // SINTETICO
    private const string ImeiB = "356938035643809";   // SINTETICO

    [Fact]
    public async Task Cria_aparelho_com_imei_cifrado_e_normalizado()
    {
        var s = await f.NovoUsuarioAsync();
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = "49-015420-323751-8", marca = "MarcaTeste", modelo = "ModeloTeste" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var corpo = await r.Content.ReadAsStringAsync();
        var j = JsonDocument.Parse(corpo).RootElement;
        Assert.Equal("7518", j.GetProperty("imeiFinal").GetString());
        Assert.DoesNotContain("4901542", corpo);
        using var db = f.NovoDb();
        var a = db.Aparelhos.Single(x => x.UsuarioId == s.UsuarioId);
        Assert.DoesNotContain("4901542", a.ImeiCifrado);
        Assert.Equal(ImeiA, f.Services.GetRequiredService<ICifrador>().Decifrar(a.ImeiCifrado));
        Assert.Equal(a.Id, j.GetProperty("aparelhoId").GetGuid());
    }

    [Fact]
    public async Task Imei_invalido_422_e_nada_gravado()
    {
        var s = await f.NovoUsuarioAsync();
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = "490154203237519", marca = "MarcaTeste", modelo = "ModeloTeste" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
        var corpo = await r.Content.ReadAsStringAsync();
        Assert.Equal("imei-invalido", JsonDocument.Parse(corpo).RootElement.GetProperty("codigo").GetString());
        Assert.DoesNotContain("4901542", corpo);
        using var db = f.NovoDb();
        Assert.Empty(db.Aparelhos.Where(x => x.UsuarioId == s.UsuarioId));
    }

    [Fact]
    public async Task Sem_token_401_e_marca_vazia_422()
    {
        var anon = f.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiA, marca = "M", modelo = "X" })).StatusCode);
        var s = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiA, marca = "  ", modelo = "ModeloTeste" })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiA, marca = "MarcaTeste", modelo = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { marca = "MarcaTeste", modelo = "ModeloTeste" })).StatusCode);
        using var db = f.NovoDb();
        Assert.Empty(db.Aparelhos.Where(x => x.UsuarioId == s.UsuarioId));
    }

    [Fact]
    public async Task Consentimento_grava_e_revoga()
    {
        var s = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await s.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = true })).StatusCode);
        using (var db = f.NovoDb())
        {
            var u = db.Usuarios.Single(x => x.Id == s.UsuarioId);
            Assert.True(u.ConsentimentoRota);
            Assert.NotNull(u.ConsentimentoEm);
        }
        Assert.True((await s.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/me")).GetProperty("consentimentoRota").GetBoolean());
        Assert.Equal(HttpStatusCode.NoContent, (await s.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = false })).StatusCode);
        Assert.False((await s.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/me")).GetProperty("consentimentoRota").GetBoolean());
        using (var db2 = f.NovoDb()) Assert.NotNull(db2.Usuarios.Single(x => x.Id == s.UsuarioId).ConsentimentoEm);
        var semAceito = await s.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, semAceito.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = true })).StatusCode);
    }

    [Fact]
    public async Task Lista_so_os_aparelhos_do_dono_com_imei_mascarado()
    {
        var s = await f.NovoUsuarioAsync();
        var outro = await f.NovoUsuarioAsync();
        await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiA, marca = "MarcaTeste", modelo = "ModeloTeste" });
        await outro.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiB, marca = "OutraMarca", modelo = "OutroModelo" });
        var corpo = await s.Cliente.GetStringAsync("/api/v1/aparelhos");
        var l = JsonDocument.Parse(corpo).RootElement;
        Assert.Equal(1, l.GetArrayLength());
        Assert.Equal("***********7518", l[0].GetProperty("imeiMascarado").GetString());
        Assert.Equal("MarcaTeste", l[0].GetProperty("marca").GetString());
        Assert.True(l[0].TryGetProperty("id", out _));
        Assert.DoesNotContain("4901542", corpo);
        Assert.DoesNotContain("356938", corpo);
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/aparelhos")).StatusCode);
    }

    [Fact]
    public async Task Imei_cifrado_mais_recente_devolve_o_cifrado_do_ultimo_aparelho()
    {
        var s = await f.NovoUsuarioAsync();
        using (var escopo = f.Services.CreateScope())
            Assert.Null(await escopo.ServiceProvider.GetRequiredService<IAparelhoService>().ImeiCifradoMaisRecenteAsync(s.UsuarioId, default));
        await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiA, marca = "Antiga", modelo = "M1" });
        f.Tempo.Advance(TimeSpan.FromMinutes(1));
        await s.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = ImeiB, marca = "Nova", modelo = "M2" });
        using var e2 = f.Services.CreateScope();
        var cif = await e2.ServiceProvider.GetRequiredService<IAparelhoService>().ImeiCifradoMaisRecenteAsync(s.UsuarioId, default);
        Assert.NotNull(cif);
        Assert.DoesNotContain("356938", cif);
        Assert.Equal(ImeiB, e2.ServiceProvider.GetRequiredService<ICifrador>().Decifrar(cif!));
        var lista = JsonDocument.Parse(await s.Cliente.GetStringAsync("/api/v1/aparelhos")).RootElement;
        Assert.Equal("Nova", lista[0].GetProperty("marca").GetString());
    }
}
