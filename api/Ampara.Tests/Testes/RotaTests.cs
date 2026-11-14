using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Rota;
using Ampara.Domain.Entidades;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class RotaTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Codigo = "482915";      // SINTETICO
    private const string Palavra = "Girassol";   // SINTETICO

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    private async Task<Sessao> UsuarioComConsentimentoAsync()
    {
        var s = await f.NovoUsuarioAsync();
        (await s.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = true })).EnsureSuccessStatusCode();
        return s;
    }

    private static object Ponto(DateTime em, double lat = -23.5, double lng = -46.7) => new { lat, lng, precisao = 5.0, em };

    private static string Iso(DateTime d) => d.ToUniversalTime().ToString("O");

    [Fact]
    public async Task Lote_valido_vira_202_e_consulta_devolve_so_a_janela_em_ordem()
    {
        var s = await UsuarioComConsentimentoAsync();
        var t = f.Tempo.GetUtcNow().UtcDateTime;
        var lote = new[] { Ponto(t.AddHours(-1), -23.1), Ponto(t.AddHours(-3), -23.3), Ponto(t.AddHours(-2), -23.2) };
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", lote)).StatusCode);

        var r = await s.Cliente.GetAsync($"/api/v1/rota?de={Uri.EscapeDataString(Iso(t.AddMinutes(-150)))}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var pontos = (await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Equal(2, pontos.Count);
        Assert.Equal(-23.2, pontos[0].GetProperty("lat").GetDouble());
        Assert.Equal(-23.1, pontos[1].GetProperty("lat").GetDouble());
        Assert.True(pontos[0].GetProperty("em").GetDateTime() < pontos[1].GetProperty("em").GetDateTime());

        // Sem filtro, o padrão são os últimos 7 dias: os 3 pontos.
        var todos = (await (await s.Cliente.GetAsync("/api/v1/rota")).Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength();
        Assert.Equal(3, todos);
    }

    [Fact]
    public async Task Lote_invalido_rejeita_tudo_sem_gravar()
    {
        var s = await UsuarioComConsentimentoAsync();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        var lote = new[] { new { lat = -23.5, lng = -46.7, precisao = 5.0, em = agora.AddMinutes(-1) }, new { lat = 91.0, lng = -46.7, precisao = 5.0, em = agora.AddMinutes(-2) } };
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", lote);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
        Assert.Equal("ponto-invalido", await CodigoDoErroAsync(r));
        using var db = f.NovoDb();
        Assert.Empty(db.Pontos.Where(p => p.UsuarioId == s.UsuarioId));
    }

    [Theory]
    [InlineData("futuro")]
    [InlineData("antigo")]
    [InlineData("grande")]
    [InlineData("lng")]
    [InlineData("precisao")]
    public async Task Outras_invalidacoes_422(string caso)
    {
        var s = await UsuarioComConsentimentoAsync();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        object[] lote = caso switch
        {
            "futuro" => [Ponto(agora.AddMinutes(-1)), Ponto(agora.AddMinutes(10))],
            "antigo" => [Ponto(agora.AddMinutes(-1)), Ponto(agora.AddDays(-8))],
            "lng" => [Ponto(agora.AddMinutes(-1)), Ponto(agora.AddMinutes(-2), lng: 181)],
            "precisao" => [Ponto(agora.AddMinutes(-1)), new { lat = 1.0, lng = 1.0, precisao = -1.0, em = agora.AddMinutes(-2) }],
            _ => Enumerable.Range(0, 501).Select(i => Ponto(agora.AddSeconds(-i - 1))).ToArray(),
        };
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", lote);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
        Assert.Equal(caso == "grande" ? "lote-grande" : "ponto-invalido", await CodigoDoErroAsync(r));
        using var db = f.NovoDb();
        Assert.Empty(db.Pontos.Where(p => p.UsuarioId == s.UsuarioId));
    }

    [Fact]
    public async Task Lote_de_500_e_vazio_sao_aceitos()
    {
        var s = await UsuarioComConsentimentoAsync();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", Array.Empty<object>())).StatusCode);
        var lote = Enumerable.Range(0, 500).Select(i => Ponto(agora.AddSeconds(-i - 1))).ToArray();
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", lote)).StatusCode);
        using var db = f.NovoDb();
        Assert.Equal(500, db.Pontos.Count(p => p.UsuarioId == s.UsuarioId));
    }

    [Fact]
    public async Task Retransmissao_do_mesmo_ponto_nao_duplica()
    {
        var s = await UsuarioComConsentimentoAsync();
        var t = f.Tempo.GetUtcNow().UtcDateTime;
        var lote = new[] { Ponto(t.AddMinutes(-3)), Ponto(t.AddMinutes(-2)), Ponto(t.AddMinutes(-1)) };
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", lote)).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", lote)).StatusCode);
        // Lote parcialmente repetido (inclusive repetido dentro do próprio lote): só o novo entra, uma vez.
        var misto = new[] { Ponto(t.AddMinutes(-1)), Ponto(t.AddMinutes(-4)), Ponto(t.AddMinutes(-4)) };
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", misto)).StatusCode);
        using var db = f.NovoDb();
        Assert.Equal(4, db.Pontos.Count(p => p.UsuarioId == s.UsuarioId));
    }

    [Fact]
    public async Task Sem_consentimento_403()
    {
        var s = await f.NovoUsuarioAsync();
        var r = await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", new[] { Ponto(f.Tempo.GetUtcNow().UtcDateTime.AddMinutes(-1)) });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Equal("consentimento-ausente", await CodigoDoErroAsync(r));
        using var db = f.NovoDb();
        Assert.Empty(db.Pontos.Where(p => p.UsuarioId == s.UsuarioId));
    }

    [Fact]
    public async Task Purga_remove_so_o_que_passou_de_7_dias()
    {
        var s = await UsuarioComConsentimentoAsync();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        using (var db = f.NovoDb())
        {
            db.Pontos.Add(PontoRota.Criar(s.UsuarioId, -23.5, -46.7, 5, agora.AddDays(-8)));
            db.Pontos.Add(PontoRota.Criar(s.UsuarioId, -23.5, -46.7, 5, agora.AddDays(-6)));
            await db.SaveChangesAsync();
        }
        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IRotaService>();
        Assert.Equal(1, await svc.PurgarExpiradosAsync(CancellationToken.None));
        using var conferir = f.NovoDb();
        var restantes = conferir.Pontos.Where(p => p.UsuarioId == s.UsuarioId).ToList();
        Assert.Single(restantes);
        Assert.Equal(agora.AddDays(-6), restantes[0].Em);
    }

    [Fact]
    public async Task Revogar_consentimento_apaga_a_rota()
    {
        var s = await UsuarioComConsentimentoAsync();
        var outro = await UsuarioComConsentimentoAsync();
        var t = f.Tempo.GetUtcNow().UtcDateTime;
        await s.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", new[] { Ponto(t.AddMinutes(-2)), Ponto(t.AddMinutes(-1)) });
        await outro.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", new[] { Ponto(t.AddMinutes(-1)) });
        Assert.Equal(HttpStatusCode.NoContent, (await s.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = false })).StatusCode);
        using var db = f.NovoDb();
        Assert.Empty(db.Pontos.Where(p => p.UsuarioId == s.UsuarioId));
        Assert.Single(db.Pontos.Where(p => p.UsuarioId == outro.UsuarioId));   // a rota alheia fica
    }

    [Fact]
    public async Task Emergencia_ve_so_a_rota_do_dono()
    {
        var dono = await UsuarioComConsentimentoAsync();
        var outro = await UsuarioComConsentimentoAsync();
        var t = f.Tempo.GetUtcNow().UtcDateTime;
        await dono.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", new[] { Ponto(t.AddMinutes(-2), -23.2) });
        await outro.Cliente.PostAsJsonAsync("/api/v1/rota/pontos", new[] { Ponto(t.AddMinutes(-1), -10.0), Ponto(t.AddMinutes(-3), -11.0) });
        (await dono.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).EnsureSuccessStatusCode();
        var emergencia = await f.ClienteEmergenciaAsync(dono.Email, Codigo, Palavra);

        var r = await emergencia.GetAsync("/api/v1/rota");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var pontos = (await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Single(pontos);
        Assert.Equal(-23.2, pontos[0].GetProperty("lat").GetDouble());

        // A sessão de emergência não grava rota (escrita é só Usuario).
        Assert.Equal(HttpStatusCode.Forbidden, (await emergencia.PostAsJsonAsync("/api/v1/rota/pontos", new[] { Ponto(t.AddMinutes(-1)) })).StatusCode);
    }

    [Fact]
    public async Task Consulta_exige_autenticacao()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/rota")).StatusCode);
    }
}
