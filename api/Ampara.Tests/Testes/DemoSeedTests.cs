using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Auth;
using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Ampara.Infrastructure.Dados;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class DemoSeedTests : IClassFixture<AmparaFactory>
{
    private static readonly string[] Emails = [DemoSeeder.EmailAdmin, DemoSeeder.EmailVitima, DemoSeeder.EmailGuardiao1, DemoSeeder.EmailGuardiao2];
    private readonly AmparaFactory f;

    public DemoSeedTests(AmparaFactory f) { this.f = f; }

    private async Task SemearAsync()
    {
        using var escopo = f.Services.CreateScope();
        var sp = escopo.ServiceProvider;
        await DemoSeeder.SemearAsync(sp.GetRequiredService<Ampara.Infrastructure.AmparaDbContext>(), sp.GetRequiredService<ISenhaHasher>(),
            sp.GetRequiredService<ICifrador>(), sp.GetRequiredService<TimeProvider>(), CancellationToken.None);
    }

    private async Task<JsonElement> LoginAsync(string email)
    {
        var r = await f.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { email, senha = DemoSeeder.SenhaDemo });
        r.EnsureSuccessStatusCode();
        return await r.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task Semear_duas_vezes_nao_duplica_e_o_admin_entra_com_papel_admin()
    {
        await SemearAsync();
        await SemearAsync();

        using var db = f.NovoDb();
        Assert.Equal(4, await db.Usuarios.CountAsync(u => Emails.Contains(u.Email)));
        var vitima = await db.Usuarios.SingleAsync(u => u.Email == DemoSeeder.EmailVitima);
        Assert.Equal(1, await db.Aparelhos.CountAsync(a => a.UsuarioId == vitima.Id));
        Assert.Equal(2, await db.Guardioes.CountAsync(g => g.UsuarioId == vitima.Id));
        var ordens = (await db.Guardioes.Where(g => g.UsuarioId == vitima.Id).ToListAsync()).OrderBy(g => g.Ordem).ToList();
        var g1 = await db.Usuarios.SingleAsync(u => u.Email == DemoSeeder.EmailGuardiao1);
        var g2 = await db.Usuarios.SingleAsync(u => u.Email == DemoSeeder.EmailGuardiao2);
        Assert.Equal([1, 2], ordens.Select(o => o.Ordem));
        Assert.Equal([g1.Id, g2.Id], ordens.Select(o => o.GuardiaoUsuarioId));
        Assert.True(vitima.ConsentimentoRota);
        Assert.True(vitima.TemEmergenciaConfigurada);

        var admin = await db.Usuarios.SingleAsync(u => u.Email == DemoSeeder.EmailAdmin);
        Assert.Equal(Papeis.Admin, admin.Papel);
        Assert.All(new[] { vitima, g1, g2 }, u => Assert.Equal(Papeis.Usuario, u.Papel));

        var token = (await LoginAsync(DemoSeeder.EmailAdmin)).GetProperty("token").GetString()!;
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("admin", jwt.Claims.Single(c => c.Type == "role").Value);
    }

    [Fact]
    public async Task Login_do_guardiao_e_a_emergencia_da_vitima_funcionam()
    {
        await SemearAsync();
        var token = (await LoginAsync(DemoSeeder.EmailGuardiao1)).GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(token));
        var emerg = await f.TokenEmergenciaAsync(DemoSeeder.EmailVitima, DemoSeeder.CodigoEmergencia, DemoSeeder.PalavraSecreta);
        Assert.False(string.IsNullOrEmpty(emerg));
    }

    [Fact]
    public async Task Com_demo_desligado_o_programa_nao_semeia_nada_nem_o_admin()
    {
        // A fabrica roda com AMPARA_DEMO=false: o Program nao chama o seeder.
        using var fabrica = new AmparaFactory();
        using var db = fabrica.NovoDb();
        Assert.Empty(await db.Usuarios.ToListAsync());
        Assert.Empty(await db.Aparelhos.ToListAsync());
        Assert.Empty(await db.Guardioes.ToListAsync());
    }
}
