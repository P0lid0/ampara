using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Chaveiros;
using Ampara.Application.Ocorrencias;
using Ampara.Domain;
using Ampara.Domain.Entidades;
using Ampara.Domain.Gatilhos;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class OcorrenciaApiTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Codigo = "123456";
    private const string Palavra = "palavra-sintetica";   // SINTETICO

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    private static async Task<Guid> IdDoCorpoAsync(HttpResponseMessage r) =>
        (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ocorrenciaId").GetGuid();

    private async Task<HttpClient> EmergenciaAsync(Sessao s)
    {
        (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).EnsureSuccessStatusCode();
        return await f.ClienteEmergenciaAsync(s.Email, Codigo, Palavra);
    }

    [Fact]
    public async Task Web_com_emergencia_cria_201_e_segundo_gatilho_reaproveita_200()
    {
        var v = await f.NovoUsuarioAsync(); var g = await f.VincularGuardiaoAsync(v);
        var em = await EmergenciaAsync(v);

        var r1 = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        Assert.Equal(HttpStatusCode.Created, r1.StatusCode);
        var id = await IdDoCorpoAsync(r1);

        var r2 = await g.Cliente.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "guardiao", vitimaId = v.UsuarioId });
        Assert.Equal(HttpStatusCode.OK, r2.StatusCode);
        Assert.Equal(id, await IdDoCorpoAsync(r2));

        using var db = f.NovoDb();
        Assert.Equal(1, await db.Ocorrencias.CountAsync(o => o.UsuarioId == v.UsuarioId && o.Estado == EstadoOcorrencia.Aberta));
    }

    [Fact]
    public async Task Vitima_sem_guardioes_dispara_sem_erro()
    {
        var v = await f.NovoUsuarioAsync();
        var em = await EmergenciaAsync(v);
        var r = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var d = await em.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{await IdDoCorpoAsync(r)}");
        Assert.Equal("Aberta", d.GetProperty("estado").GetString());
        Assert.Equal(0, d.GetProperty("alertas").GetArrayLength());
    }

    [Fact]
    public async Task Indice_unico_impede_duas_abertas_da_mesma_vitima()
    {
        var u = await f.NovoUsuarioAsync();
        using var db = f.NovoDb();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        db.Ocorrencias.Add(Ocorrencia.Iniciar(u.UsuarioId, OrigemGatilho.Web, agora));
        db.Ocorrencias.Add(Ocorrencia.Iniciar(u.UsuarioId, OrigemGatilho.Web, agora));
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Origem_incompativel_422_e_nao_guardiao_403()
    {
        var v = await f.NovoUsuarioAsync(); var estranho = await f.NovoUsuarioAsync(); var outro = await f.NovoUsuarioAsync();
        var em = await EmergenciaAsync(v);

        // emergencia exige web; usuario exige guardiao.
        var a = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "guardiao", vitimaId = v.UsuarioId });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, a.StatusCode);
        Assert.Equal("origem-invalida", await CodigoDoErroAsync(a));
        var b = await estranho.Cliente.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, b.StatusCode);
        var c = await estranho.Cliente.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "chaveiro", vitimaId = v.UsuarioId });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, c.StatusCode);
        var semVitima = await estranho.Cliente.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "guardiao" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, semVitima.StatusCode);

        // vitimaId diferente do sub na emergencia: 403.
        var d = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web", vitimaId = outro.UsuarioId });
        Assert.Equal(HttpStatusCode.Forbidden, d.StatusCode);

        // nao e guardiao da vitima: 403.
        var e = await estranho.Cliente.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "guardiao", vitimaId = v.UsuarioId });
        Assert.Equal(HttpStatusCode.Forbidden, e.StatusCode);

        using var db = f.NovoDb();
        Assert.Equal(0, await db.Ocorrencias.CountAsync(o => o.UsuarioId == v.UsuarioId));
    }

    [Fact]
    public async Task Guardiao_nao_ve_momento_e_estranho_leva_403_com_registro()
    {
        var v = await f.NovoUsuarioAsync(); var g = await f.VincularGuardiaoAsync(v); var estranho = await f.NovoUsuarioAsync();
        var em = await EmergenciaAsync(v);
        var id = await IdDoCorpoAsync(await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" }));
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        Assert.Equal(HttpStatusCode.NoContent, (await v.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = agora.AddMinutes(-5), lat = -23.56, lng = -46.69 })).StatusCode);

        var doGuardiao = await g.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}");
        Assert.Equal(JsonValueKind.Null, doGuardiao.GetProperty("momento").ValueKind);

        f.Acesso.Limpar();
        Assert.Equal(HttpStatusCode.Forbidden, (await estranho.Cliente.GetAsync($"/api/v1/ocorrencias/{id}")).StatusCode);
        var chamada = Assert.Single(f.Acesso.Chamadas);
        Assert.Equal("recurso-de-outro-usuario", chamada.Campo);
        Assert.Equal(v.UsuarioId, chamada.UsuarioAlvoId);

        Assert.Equal(HttpStatusCode.NotFound, (await v.Cliente.GetAsync($"/api/v1/ocorrencias/{Guid.NewGuid()}")).StatusCode);
        // guardiao nao marca momento nem cancela.
        f.Acesso.Limpar();
        Assert.Equal(HttpStatusCode.Forbidden, (await g.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = agora, lat = -23.5, lng = -46.6 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await g.Cliente.PostAsync($"/api/v1/ocorrencias/{id}/cancelar", null)).StatusCode);
        Assert.Empty(f.Acesso.Chamadas);   // guardiao legitimo nao e acesso indevido

        // ja o estranho, ao tentar cancelar, e registrado.
        Assert.Equal(HttpStatusCode.Forbidden, (await estranho.Cliente.PostAsync($"/api/v1/ocorrencias/{id}/cancelar", null)).StatusCode);
        Assert.Equal("recurso-de-outro-usuario", Assert.Single(f.Acesso.Chamadas).Campo);
    }

    [Fact]
    public async Task Cancelar_com_gateway_fora_do_ar_mantem_aberta_e_permite_repetir()
    {
        var v = await f.NovoUsuarioAsync();
        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IOcorrenciaService>();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        var criada = await svc.DispararAsync(new GatilhoChaveiro("chaveiro-ampara-ff0011", "chaveiro-ampara-ff0011-3", agora), v.UsuarioId, CancellationToken.None);
        f.Gateway.Limpar();

        f.Gateway.Falhar = true;
        try
        {
            var falha = await v.Cliente.PostAsync($"/api/v1/ocorrencias/{criada.OcorrenciaId}/cancelar", null);
            Assert.False(falha.IsSuccessStatusCode);
        }
        finally { f.Gateway.Falhar = false; }
        var aberta = await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{criada.OcorrenciaId}");
        Assert.Equal("Aberta", aberta.GetProperty("estado").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await v.Cliente.PostAsync($"/api/v1/ocorrencias/{criada.OcorrenciaId}/cancelar", null)).StatusCode);
        Assert.Equal(ComandoChaveiro.Resolve("chaveiro-ampara-ff0011-3"), Assert.Single(f.Gateway.Publicados).Cmd);
    }

    [Fact]
    public async Task Depois_de_cancelar_novo_gatilho_cria_outra_ocorrencia()
    {
        var v = await f.NovoUsuarioAsync();
        var em = await EmergenciaAsync(v);
        var id1 = await IdDoCorpoAsync(await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" }));
        Assert.Equal(HttpStatusCode.NoContent, (await v.Cliente.PostAsync($"/api/v1/ocorrencias/{id1}/cancelar", null)).StatusCode);

        var r2 = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        Assert.Equal(HttpStatusCode.Created, r2.StatusCode);
        Assert.NotEqual(id1, await IdDoCorpoAsync(r2));
    }

    [Fact]
    public async Task Listagem_traz_as_proprias_e_o_guardiao_ve_as_da_vitima()
    {
        var v = await f.NovoUsuarioAsync(); var g = await f.VincularGuardiaoAsync(v); var estranho = await f.NovoUsuarioAsync();
        var em = await EmergenciaAsync(v);
        var id = await IdDoCorpoAsync(await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" }));

        Assert.Equal(id, (await v.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/ocorrencias"))[0].GetProperty("id").GetGuid());
        Assert.Equal(id, (await em.GetFromJsonAsync<JsonElement>("/api/v1/ocorrencias"))[0].GetProperty("id").GetGuid());
        Assert.Equal(id, (await g.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/ocorrencias"))[0].GetProperty("id").GetGuid());
        Assert.Equal(0, (await estranho.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/ocorrencias")).GetArrayLength());
    }

    [Fact]
    public async Task Momento_204_e_aparece_para_o_dono()
    {
        var v = await f.NovoUsuarioAsync();
        var em = await EmergenciaAsync(v);
        var id = await IdDoCorpoAsync(await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" }));
        var quando = f.Tempo.GetUtcNow().UtcDateTime.AddMinutes(-20);
        Assert.Equal(HttpStatusCode.NoContent, (await em.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = quando, lat = -23.56, lng = -46.69 })).StatusCode);
        var d = await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}");
        Assert.Equal(-23.56, d.GetProperty("momento").GetProperty("lat").GetDouble());
        Assert.Equal(-46.69, d.GetProperty("momento").GetProperty("lng").GetDouble());

        var futuro = await v.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = quando.AddHours(2), lat = -23.56, lng = -46.69 });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, futuro.StatusCode);
        var lat = await v.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = quando, lat = 120.0, lng = -46.69 });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, lat.StatusCode);
        var faltando = await v.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { lat = -23.5 });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, faltando.StatusCode);
    }

    [Fact]
    public async Task Detalhe_traz_estado_passos_alertas_momento_e_contas_no_formato_do_contrato()
    {
        var v = await f.NovoUsuarioAsync(); var g = await f.VincularGuardiaoAsync(v);
        (await v.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "nubank" })).EnsureSuccessStatusCode();
        (await v.Cliente.PostAsJsonAsync("/api/v1/contas", new { catalogoId = "vivo" })).EnsureSuccessStatusCode();
        var em = await EmergenciaAsync(v);
        var id = await IdDoCorpoAsync(await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" }));
        var quando = f.Tempo.GetUtcNow().UtcDateTime.AddMinutes(-30);
        (await v.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/momento", new { em = quando, lat = -23.56, lng = -46.69 })).EnsureSuccessStatusCode();

        var d = await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}");
        Assert.Equal("Aberta", d.GetProperty("estado").GetString());
        Assert.Equal("web", d.GetProperty("origem").GetString());
        Assert.Equal(5, d.GetProperty("passos").GetArrayLength());
        foreach (var p in d.GetProperty("passos").EnumerateArray())
        {
            Assert.Equal(["concluidoEm", "passo"], p.EnumerateObject().Select(x => x.Name).Order().ToArray());
            Assert.Equal(JsonValueKind.Null, p.GetProperty("concluidoEm").ValueKind);
        }
        Assert.Equal(["Banco", "Bo", "CelularSeguro", "Operadora", "Senhas"], d.GetProperty("passos").EnumerateArray().Select(p => p.GetProperty("passo").GetString()!).Order().ToArray());
        // O guardião já foi alertado no disparo (Task 13): um alerta, ainda sem ciente.
        var alerta = Assert.Single(d.GetProperty("alertas").EnumerateArray());
        Assert.Equal(["alertaId", "cienteEm", "enviadoEm", "guardiaoId"], alerta.EnumerateObject().Select(x => x.Name).Order().ToArray());
        Assert.Equal(JsonValueKind.Null, alerta.GetProperty("cienteEm").ValueKind);
        var m = d.GetProperty("momento");
        Assert.EndsWith("Z", m.GetProperty("em").GetString());
        Assert.Equal(-23.56, m.GetProperty("lat").GetDouble());
        var contas = d.GetProperty("contas");
        Assert.Equal(2, contas.GetArrayLength());
        foreach (var c in contas.EnumerateArray())
            Assert.Equal(["link", "nome", "telefone", "tipo"], c.EnumerateObject().Select(x => x.Name).Order().ToArray());

        var dg = await g.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}");
        Assert.Equal(JsonValueKind.Null, dg.GetProperty("momento").ValueKind);
        Assert.Equal(2, dg.GetProperty("contas").GetArrayLength());
        Assert.Equal(5, dg.GetProperty("passos").GetArrayLength());
    }

    [Fact]
    public async Task Cancelar_204_depois_409_e_chaveiro_recebe_resolve()
    {
        var v = await f.NovoUsuarioAsync();
        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IOcorrenciaService>();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        var criada = await svc.DispararAsync(new GatilhoChaveiro("chaveiro-ampara-a1b2c3", "chaveiro-ampara-a1b2c3-17", agora), v.UsuarioId, CancellationToken.None);
        Assert.True(criada.Nova);
        f.Gateway.Limpar();

        Assert.Equal(HttpStatusCode.NoContent, (await v.Cliente.PostAsync($"/api/v1/ocorrencias/{criada.OcorrenciaId}/cancelar", null)).StatusCode);
        var pub = Assert.Single(f.Gateway.Publicados);
        Assert.Equal("chaveiro-ampara-a1b2c3", pub.DeviceId);
        Assert.Equal(ComandoChaveiro.Resolve("chaveiro-ampara-a1b2c3-17"), pub.Cmd);

        var de = await v.Cliente.PostAsync($"/api/v1/ocorrencias/{criada.OcorrenciaId}/cancelar", null);
        Assert.Equal(HttpStatusCode.Conflict, de.StatusCode);
        Assert.Equal("ocorrencia-nao-aberta", await CodigoDoErroAsync(de));
        Assert.Single(f.Gateway.Publicados);
        var d = await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{criada.OcorrenciaId}");
        Assert.Equal("Cancelada", d.GetProperty("estado").GetString());
        Assert.Equal("chaveiro", d.GetProperty("origem").GetString());
    }

    [Fact]
    public async Task Cancelar_por_chaveiro_nao_devolve_resolve()
    {
        var v = await f.NovoUsuarioAsync();
        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IOcorrenciaService>();
        var criada = await svc.DispararAsync(new GatilhoChaveiro("chaveiro-ampara-d4e5f6", "chaveiro-ampara-d4e5f6-3", f.Tempo.GetUtcNow().UtcDateTime), v.UsuarioId, CancellationToken.None);
        f.Gateway.Limpar();
        await svc.CancelarPorChaveiroAsync("chaveiro-ampara-d4e5f6", "chaveiro-ampara-d4e5f6-3", CancellationToken.None);
        await svc.CancelarPorChaveiroAsync("chaveiro-ampara-d4e5f6", "chaveiro-ampara-d4e5f6-3", CancellationToken.None);   // sem aberta: ignora
        Assert.Empty(f.Gateway.Publicados);
        Assert.Equal("Cancelada", (await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{criada.OcorrenciaId}")).GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Comando_resolve_sem_alerta_409_e_com_alerta_publica()
    {
        var v = await f.NovoUsuarioAsync();
        var dev = "chaveiro-ampara-" + Guid.NewGuid().ToString("N")[..8];
        (await v.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = dev })).EnsureSuccessStatusCode();
        f.Gateway.Limpar();
        var sem = await v.Cliente.PostAsJsonAsync($"/api/v1/chaveiros/{dev}/comandos", new { cmd = "resolve" });
        Assert.Equal(HttpStatusCode.Conflict, sem.StatusCode);
        Assert.Equal("sem-alerta-ativo", await CodigoDoErroAsync(sem));
        Assert.Empty(f.Gateway.Publicados);

        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IOcorrenciaService>();
        await svc.DispararAsync(new GatilhoChaveiro(dev, dev + "-9", f.Tempo.GetUtcNow().UtcDateTime), v.UsuarioId, CancellationToken.None);
        Assert.Equal(HttpStatusCode.Accepted, (await v.Cliente.PostAsJsonAsync($"/api/v1/chaveiros/{dev}/comandos", new { cmd = "resolve" })).StatusCode);
        Assert.Equal(ComandoChaveiro.Resolve(dev + "-9"), Assert.Single(f.Gateway.Publicados).Cmd);
    }
}
