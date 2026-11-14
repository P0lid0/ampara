using System.Net.Http.Json;
using Ampara.Tests.Infra;

namespace Ampara.Tests;

/// <summary>Fábrica própria: estes testes avançam o relógio e não podem afetar as outras classes.</summary>
public class TokenValidadeTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Codigo = "482915";      // SINTETICO
    private const string Palavra = "Girassol";   // SINTETICO

    [Fact]
    public async Task Token_de_emergencia_expira_em_30_minutos()
    {
        var s = await f.NovoUsuarioAsync();
        (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).EnsureSuccessStatusCode();
        var em = await f.ClienteEmergenciaAsync(s.Email, Codigo, Palavra);
        Assert.Equal(HttpStatusCode.OK, (await em.GetAsync("/api/v1/rota")).StatusCode);

        f.Tempo.Advance(TimeSpan.FromMinutes(29));
        Assert.Equal(HttpStatusCode.OK, (await em.GetAsync("/api/v1/rota")).StatusCode);
        f.Tempo.Advance(TimeSpan.FromMinutes(2));   // 31 min: passou da validade e da tolerância de 30 s
        Assert.Equal(HttpStatusCode.Unauthorized, (await em.GetAsync("/api/v1/rota")).StatusCode);
    }

    [Fact]
    public async Task Token_de_login_expira_em_8_horas()
    {
        var s = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.OK, (await s.Cliente.GetAsync("/api/v1/rota")).StatusCode);

        f.Tempo.Advance(TimeSpan.FromHours(8));
        Assert.Equal(HttpStatusCode.OK, (await s.Cliente.GetAsync("/api/v1/rota")).StatusCode);   // dentro da tolerância
        f.Tempo.Advance(TimeSpan.FromSeconds(31));
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.Cliente.GetAsync("/api/v1/rota")).StatusCode);
    }
}
