using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class ChaveiroTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static string NovoId() => "chaveiro-ampara-" + Guid.NewGuid().ToString("N")[..8];

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    [Fact]
    public async Task Pareia_lista_e_envia_find()
    {
        var s = await f.NovoUsuarioAsync();
        var id = NovoId();
        f.Gateway.Limpar();
        Assert.Equal(HttpStatusCode.Created, (await s.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = id })).StatusCode);
        var l = await s.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/chaveiros");
        Assert.Equal(id, l[0].GetProperty("deviceId").GetString());
        Assert.False(l[0].GetProperty("online").GetBoolean());
        Assert.Equal(HttpStatusCode.Accepted, (await s.Cliente.PostAsJsonAsync($"/api/v1/chaveiros/{id}/comandos", new { cmd = "find" })).StatusCode);
        Assert.Equal((id, "find"), (f.Gateway.Publicados.Single().DeviceId, f.Gateway.Publicados.Single().Cmd.Cmd));
    }

    [Fact]
    public async Task DeviceId_invalido_422_e_ja_pareado_409()
    {
        var a = await f.NovoUsuarioAsync(); var b = await f.NovoUsuarioAsync();
        foreach (var ruim in new[] { "ABC", "Chaveiro_X", "curto-1", "-comeca-com-hifen", new string('a', 65) })
        {
            var r = await a.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = ruim });
            Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
            Assert.Equal("device-id-invalido", await CodigoDoErroAsync(r));
        }
        var id = NovoId();
        Assert.Equal(HttpStatusCode.Created, (await a.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = id })).StatusCode);
        var dup = await b.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = id });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
        Assert.Equal("chaveiro-ja-pareado", await CodigoDoErroAsync(dup));
        var mesmo = await a.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = id });
        Assert.Equal(HttpStatusCode.Conflict, mesmo.StatusCode);
    }

    [Fact]
    public async Task Comando_em_chaveiro_alheio_403_e_registra_acesso_indevido()
    {
        var dono = await f.NovoUsuarioAsync(); var intruso = await f.NovoUsuarioAsync();
        var id = NovoId();
        (await dono.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = id })).EnsureSuccessStatusCode();
        f.Gateway.Limpar(); f.Acesso.Limpar();
        var r = await intruso.Cliente.PostAsJsonAsync($"/api/v1/chaveiros/{id}/comandos", new { cmd = "find" });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        var c = Assert.Single(f.Acesso.Chamadas);
        Assert.Equal("recurso-de-outro-usuario", c.Campo);
        Assert.Equal(dono.UsuarioId, c.UsuarioAlvoId);
        Assert.Empty(f.Gateway.Publicados);
    }

    [Fact]
    public async Task Comando_invalido_422_resolve_sem_alerta_409_e_inexistente_404()
    {
        var s = await f.NovoUsuarioAsync();
        var id = NovoId();
        (await s.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = id })).EnsureSuccessStatusCode();
        f.Gateway.Limpar();
        var ruim = await s.Cliente.PostAsJsonAsync($"/api/v1/chaveiros/{id}/comandos", new { cmd = "explodir" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, ruim.StatusCode);
        var res = await s.Cliente.PostAsJsonAsync($"/api/v1/chaveiros/{id}/comandos", new { cmd = "resolve" });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);   // resolve existe desde a T11; sem alerta ativo e 409
        Assert.Equal("sem-alerta-ativo", await CodigoDoErroAsync(res));
        Assert.Equal(HttpStatusCode.NotFound, (await s.Cliente.PostAsJsonAsync("/api/v1/chaveiros/nao-existe-123/comandos", new { cmd = "ping" })).StatusCode);
        Assert.Empty(f.Gateway.Publicados);
    }

    [Fact]
    public async Task Lista_so_mostra_os_chaveiros_do_usuario_e_exige_login()
    {
        var a = await f.NovoUsuarioAsync(); var b = await f.NovoUsuarioAsync();
        (await a.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = NovoId() })).EnsureSuccessStatusCode();
        Assert.Equal(0, (await b.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/chaveiros")).GetArrayLength());
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/chaveiros")).StatusCode);
    }

    [Fact]
    public void Status_preserva_bateria_quando_nula_e_marca_baixa()
    {
        var c = Chaveiro.Parear(Guid.NewGuid(), "chaveiro-ampara-a1b2c3", DateTime.UtcNow);
        c.AtualizarStatus(true, 82, DateTime.UtcNow); c.AtualizarStatus(false, null, DateTime.UtcNow);
        Assert.Equal(82, c.Bateria); Assert.False(c.Online);
        Assert.False(c.BateriaBaixa);
        c.AtualizarStatus(true, 15, DateTime.UtcNow); Assert.True(c.BateriaBaixa);
        c.AtualizarStatus(true, 16, DateTime.UtcNow); Assert.False(c.BateriaBaixa);
        c.RegistrarSinal(null, DateTime.UtcNow); Assert.True(c.Online); Assert.Equal(16, c.Bateria);
    }

    [Fact]
    public void Comando_serializa_no_formato_do_contrato_mqtt()
    {
        Assert.Equal("{\"cmd\":\"ack\",\"eventId\":\"chaveiro-ampara-a1b2c3-17\"}", JsonSerializer.Serialize(ComandoChaveiro.Ack("chaveiro-ampara-a1b2c3-17")));
        Assert.Equal("{\"cmd\":\"find\"}", JsonSerializer.Serialize(ComandoChaveiro.Find()));
        Assert.Equal("{\"cmd\":\"resolve\",\"alertId\":\"a-1\"}", JsonSerializer.Serialize(ComandoChaveiro.Resolve("a-1")));
        Assert.Equal("{\"cmd\":\"ping\"}", JsonSerializer.Serialize(ComandoChaveiro.Ping()));
    }

    [Fact]
    public async Task Falha_de_gravacao_que_nao_e_unicidade_sobe_sem_virar_409()
    {
        // Usuário inexistente: viola a FK (não o índice único). Não pode ser reportado como "já pareado".
        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IChaveiroService>();
        await Assert.ThrowsAsync<DbUpdateException>(() => svc.ParearAsync(Guid.NewGuid(), NovoId(), CancellationToken.None));
    }

    [Fact]
    public async Task Lista_vem_na_ordem_do_pareamento()
    {
        // Grava direto com PareadoEm fora da ordem de inserção (t+2, t+0, t+1): sem o OrderBy do serviço
        // o SQLite devolveria na ordem de inserção e o teste quebraria. Não mexe no relógio compartilhado.
        var s = await f.NovoUsuarioAsync();
        var t0 = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        var (a, b, c) = (NovoId(), NovoId(), NovoId());
        var db = f.NovoDb();
        // Um SaveChanges por linha: o EF reordena inserts do mesmo lote pela chave (Guid aleatório).
        foreach (var (id, em) in new[] { (c, t0.AddMinutes(2)), (a, t0), (b, t0.AddMinutes(1)) })
        {
            db.Chaveiros.Add(Chaveiro.Parear(s.UsuarioId, id, em));
            await db.SaveChangesAsync();
        }

        var l = await s.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/chaveiros");
        Assert.Equal(new[] { a, b, c }, l.EnumerateArray().Select(e => e.GetProperty("deviceId").GetString()!).ToArray());
    }
}
