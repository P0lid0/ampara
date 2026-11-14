using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Ampara.Tests;

public class AuthTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Senha = "senha-sintetica-1";   // SINTETICO

    [Fact]
    public async Task Registrar_201_e_login_normaliza_email()
    {
        var c = f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Pessoa Teste", email = "  Pessoa@Ampara.Demo ", senha = Senha });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.True((await r.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("usuarioId", out _));
        var l = await c.PostAsJsonAsync("/api/v1/auth/login", new { email = "pessoa@ampara.demo", senha = Senha });
        Assert.Equal(HttpStatusCode.OK, l.StatusCode);
        var dup = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Outra", email = "PESSOA@ampara.demo", senha = "senha-sintetica-2" });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
    }

    [Fact]
    public async Task Login_errado_e_email_desconhecido_dao_401_identico()
    {
        var c = f.CreateClient();
        await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Pessoa", email = "erro401@ampara.demo", senha = Senha });
        var errada = await c.PostAsJsonAsync("/api/v1/auth/login", new { email = "erro401@ampara.demo", senha = "senha-errada-123" });
        var desconhecido = await c.PostAsJsonAsync("/api/v1/auth/login", new { email = "ninguem@ampara.demo", senha = Senha });
        Assert.Equal(HttpStatusCode.Unauthorized, errada.StatusCode);
        Assert.Equal(errada.StatusCode, desconhecido.StatusCode);
        var j1 = await errada.Content.ReadFromJsonAsync<JsonElement>();
        var j2 = await desconhecido.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("credenciais-invalidas", j1.GetProperty("codigo").GetString());
        Assert.Equal("credenciais-invalidas", j2.GetProperty("codigo").GetString());
    }

    [Theory]
    [InlineData("Pessoa", "curta@ampara.demo", "1234567")]
    [InlineData("", "semnome@ampara.demo", Senha)]
    [InlineData("   ", "brancos@ampara.demo", Senha)]
    public async Task Senha_curta_e_nome_vazio_422(string nome, string email, string senha)
    {
        var r = await f.CreateClient().PostAsJsonAsync("/api/v1/auth/registrar", new { nome, email, senha });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
    }

    [Fact]
    public async Task Nome_email_e_senha_longos_demais_422_sem_chegar_ao_banco()
    {
        var c = f.CreateClient();
        var casos = new[]
        {
            new { nome = new string('n', 201), email = "longo1@ampara.demo", senha = Senha },
            new { nome = "Pessoa", email = new string('e', 320) + "@ampara.demo", senha = Senha },
            new { nome = "Pessoa", email = "longo3@ampara.demo", senha = new string('s', 257) },
        };
        foreach (var caso in casos)
            Assert.Equal(HttpStatusCode.UnprocessableEntity, (await c.PostAsJsonAsync("/api/v1/auth/registrar", caso)).StatusCode);
        // limites exatos continuam aceitos
        var ok = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome = new string('n', 200), email = "limite@ampara.demo", senha = new string('s', 256) });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task Registro_nunca_cria_admin_mesmo_com_papel_no_corpo()
    {
        var c = f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Pessoa", email = "naoadmin@ampara.demo", senha = Senha, papel = "admin", role = "admin" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var l = await c.PostAsJsonAsync("/api/v1/auth/login", new { email = "naoadmin@ampara.demo", senha = Senha });
        var tok = (await l.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(tok);
        Assert.Equal("usuario", jwt.Claims.Single(x => x.Type == "role").Value);
        using var escopo = f.Services.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<IAmparaDb>();
        Assert.Equal("usuario", db.Usuarios.Single(u => u.Email == "naoadmin@ampara.demo").Papel);
    }

    [Fact]
    public async Task Token_tem_claims_e_validade_de_8h()
    {
        var c = f.CreateClient();
        var reg = await c.PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Pessoa", email = "claims@ampara.demo", senha = Senha });
        var id = (await reg.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("usuarioId").GetGuid();
        var l = await c.PostAsJsonAsync("/api/v1/auth/login", new { email = "claims@ampara.demo", senha = Senha });
        var corpo = await l.Content.ReadFromJsonAsync<JsonElement>();
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(corpo.GetProperty("token").GetString());
        Assert.Equal(id.ToString(), jwt.Claims.Single(x => x.Type == "sub").Value);
        Assert.Equal("usuario", jwt.Claims.Single(x => x.Type == "role").Value);
        Assert.Equal("usuario", jwt.Claims.Single(x => x.Type == "scope").Value);
        var esperado = f.Tempo.GetUtcNow().UtcDateTime.AddHours(8);
        var expira = corpo.GetProperty("expiraEm").GetDateTime().ToUniversalTime();
        Assert.InRange((expira - esperado).TotalSeconds, -5, 5);
        Assert.InRange((jwt.ValidTo - esperado).TotalSeconds, -5, 5);
    }

    [Fact]
    public void Segredo_curto_derruba_a_subida()
    {
        using var fabrica = new AmparaFactory(jwtSecret: "curto");
        Assert.Throws<InvalidOperationException>(() => fabrica.CreateClient());
    }
}
