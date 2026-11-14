using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Tests.Infra;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class EmergenciaTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Codigo = "482915";      // SINTETICO
    private const string Palavra = "Girassol";   // SINTETICO

    private static Task<HttpResponseMessage> Entrar(HttpClient c, string email, string codigo, string palavra)
        => c.PostAsJsonAsync("/api/v1/auth/emergencia", new { email, codigo, palavraSecreta = palavra });

    [Fact]
    public async Task Define_e_entra_com_palavra_sem_diferenciar_caixa()
    {
        var s = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).StatusCode);
        var r = await Entrar(f.CreateClient(), "  " + s.Email.ToUpperInvariant() + " ", Codigo, "  GIRASSOL ");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.Content.ReadFromJsonAsync<JsonElement>();
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(j.GetProperty("token").GetString());
        Assert.Equal("emergencia", jwt.Claims.First(c => c.Type == "scope").Value);
        Assert.Equal(s.UsuarioId.ToString(), jwt.Claims.First(c => c.Type == "sub").Value);
        var esperado = f.Tempo.GetUtcNow().UtcDateTime.AddMinutes(30);
        Assert.InRange(Math.Abs((j.GetProperty("expiraEm").GetDateTime().ToUniversalTime() - esperado).TotalSeconds), 0, 5);
    }

    [Fact]
    public async Task Purga_apaga_tentativas_com_mais_de_24_horas()
    {
        // A tabela guarda o e-mail digitado (mesmo de quem não tem conta); só os últimos 15 min contam para o bloqueio.
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        var antigo = $"antigo{Guid.NewGuid():N}@ampara.demo";
        var recente = $"recente{Guid.NewGuid():N}@ampara.demo";
        using (var db = f.NovoDb())
        {
            db.TentativasEmergencia.Add(Ampara.Domain.Entidades.TentativaEmergencia.Criar(antigo, agora.AddHours(-25), sucesso: false));
            db.TentativasEmergencia.Add(Ampara.Domain.Entidades.TentativaEmergencia.Criar(recente, agora.AddHours(-1), sucesso: false));
            await db.SaveChangesAsync();
        }
        using (var escopo = f.Services.CreateScope())
            Assert.True(await escopo.ServiceProvider.GetRequiredService<Ampara.Application.Auth.IAuthService>().PurgarTentativasAsync(CancellationToken.None) >= 1);
        using (var db = f.NovoDb())
        {
            Assert.Empty(db.TentativasEmergencia.Where(t => t.EmailNormalizado == antigo));
            Assert.Single(db.TentativasEmergencia.Where(t => t.EmailNormalizado == recente));
        }
    }

    [Fact]
    public async Task Codigo_e_palavra_invalidos_na_definicao_422()
    {
        var s = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "12", palavraSecreta = Palavra })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = "ab" })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "12345678901", palavraSecreta = Palavra })).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "12a456", palavraSecreta = Palavra })).StatusCode);
    }

    [Fact]
    public async Task Cinco_erros_bloqueiam_ate_a_janela_passar()
    {
        var s = await f.NovoUsuarioAsync();
        await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra });
        var anonimo = f.CreateClient();
        f.Acesso.Limpar();
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await Entrar(anonimo, s.Email, "000000", Palavra)).StatusCode);
        var chamadas = f.Acesso.Chamadas;
        Assert.Equal(5, chamadas.Count);
        Assert.All(chamadas, c => { Assert.Equal("codigo-emergencia", c.Campo); Assert.Equal(s.UsuarioId, c.UsuarioAlvoId); });

        var bloqueada = await Entrar(anonimo, s.Email, Codigo, Palavra);
        Assert.Equal(HttpStatusCode.TooManyRequests, bloqueada.StatusCode);
        Assert.True(bloqueada.Headers.RetryAfter!.Delta!.Value.TotalSeconds > 0);
        Assert.Equal(5, f.Acesso.Chamadas.Count);   // a barrada não conta como novo erro

        f.Tempo.Advance(TimeSpan.FromMinutes(16));
        Assert.Equal(HttpStatusCode.OK, (await Entrar(anonimo, s.Email, Codigo, Palavra)).StatusCode);
    }

    [Fact]
    public async Task Email_desconhecido_da_401_e_tambem_conta()
    {
        var email = $"ninguem{Guid.NewGuid():N}@ampara.demo";
        var anonimo = f.CreateClient();
        f.Acesso.Limpar();
        for (var i = 0; i < 5; i++)
        {
            var r = await Entrar(anonimo, email, Codigo, Palavra);
            Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
            Assert.Equal("credenciais-invalidas", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
        }
        Assert.Equal(HttpStatusCode.TooManyRequests, (await Entrar(anonimo, email, Codigo, Palavra)).StatusCode);
        Assert.Equal(5, f.Acesso.Chamadas.Count);
        Assert.All(f.Acesso.Chamadas, c => Assert.Null(c.UsuarioAlvoId));
    }

    [Fact]
    public async Task Requisicoes_paralelas_nao_passam_de_5_erros()
    {
        var s = await f.NovoUsuarioAsync();
        await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra });
        var anonimo = f.CreateClient();
        f.Acesso.Limpar();
        var respostas = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => Entrar(anonimo, s.Email, "000000", Palavra)));
        Assert.Equal(5, respostas.Count(r => r.StatusCode == HttpStatusCode.Unauthorized));
        Assert.Equal(7, respostas.Count(r => r.StatusCode == HttpStatusCode.TooManyRequests));
        Assert.Equal(5, f.Acesso.Chamadas.Count);
    }

    [Fact]
    public async Task Usuario_sem_emergencia_configurada_da_o_mesmo_401()
    {
        var s = await f.NovoUsuarioAsync();
        var r = await Entrar(f.CreateClient(), s.Email, Codigo, Palavra);
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal("credenciais-invalidas", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task So_a_palavra_errada_tambem_e_erro()
    {
        var s = await f.NovoUsuarioAsync();
        await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra });
        Assert.Equal(HttpStatusCode.Unauthorized, (await Entrar(f.CreateClient(), s.Email, Codigo, "outra")).StatusCode);
    }

    [Fact]
    public async Task Token_de_emergencia_nao_acessa_rota_de_usuario()
    {
        var s = await f.NovoUsuarioAsync();
        await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra });
        var emergencia = await f.ClienteEmergenciaAsync(s.Email, Codigo, Palavra);
        Assert.Equal(HttpStatusCode.Forbidden, (await emergencia.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "111111", palavraSecreta = "outra" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await emergencia.GetAsync("/api/v1/me")).StatusCode);
    }

    [Fact]
    public async Task Me_devolve_o_perfil_do_dono()
    {
        var s = await f.NovoUsuarioAsync("Pessoa Teste");
        var antes = await s.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/me");
        Assert.Equal(s.UsuarioId, antes.GetProperty("usuarioId").GetGuid());
        Assert.Equal("Pessoa Teste", antes.GetProperty("nome").GetString());
        Assert.Equal(s.Email, antes.GetProperty("email").GetString());
        Assert.False(antes.GetProperty("consentimentoRota").GetBoolean());
        Assert.False(antes.GetProperty("emergenciaConfigurada").GetBoolean());
        await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra });
        Assert.True((await s.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/me")).GetProperty("emergenciaConfigurada").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/me")).StatusCode);
        var corpo = await (await s.Cliente.GetAsync("/api/v1/me")).Content.ReadAsStringAsync();
        Assert.DoesNotContain(Codigo, corpo);
        Assert.DoesNotContain("senhaHash", corpo, StringComparison.OrdinalIgnoreCase);
    }
}
