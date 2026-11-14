using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Chaveiros;
using Ampara.Application.Ocorrencias;
using Ampara.Domain;
using Ampara.Domain.Gatilhos;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class PassosTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static string Rota(Guid id, string passo) => $"/api/v1/ocorrencias/{id}/passos/{passo}/concluir";

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r) =>
        (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;

    [Fact]
    public async Task Guardiao_conclui_passo_e_todos_sao_notificados()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        Assert.Equal(HttpStatusCode.NoContent, (await c.B.Cliente.PostAsync(Rota(c.OcorrenciaId, "Banco"), null)).StatusCode);

        foreach (var ev in new[] { c.EventosA, c.EventosB, c.EventosC })
        {
            var m = await CenarioAlerta.EsperarAsync(ev.Passos);
            Assert.Equal(c.OcorrenciaId, m.OcorrenciaId);
            Assert.Equal("Banco", m.Passo);
        }
        var d = await c.V.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{c.OcorrenciaId}");
        var banco = d.GetProperty("passos").EnumerateArray().Single(p => p.GetProperty("passo").GetString() == "Banco");
        Assert.EndsWith("Z", banco.GetProperty("concluidoEm").GetString());
    }

    [Fact]
    public async Task Passo_invalido_422_dono_403_e_repeticao_idempotente()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        var invalido = await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, "Inexistente"), null);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalido.StatusCode);
        Assert.Equal("passo-invalido", await CodigoDoErroAsync(invalido));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, "1"), null)).StatusCode);

        f.Acesso.Limpar();
        Assert.Equal(HttpStatusCode.Forbidden, (await c.V.Cliente.PostAsync(Rota(c.OcorrenciaId, "Banco"), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.Emergencia.PostAsync(Rota(c.OcorrenciaId, "Banco"), null)).StatusCode);
        Assert.Equal(2, f.Acesso.Chamadas.Count);
        var estranho = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await estranho.Cliente.PostAsync(Rota(c.OcorrenciaId, "Banco"), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.A.Cliente.PostAsync(Rota(Guid.NewGuid(), "Banco"), null)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, "senhas"), null)).StatusCode);   // sem diferenciar maiusculas
        var antes = await HorarioAsync(c, "Senhas");
        Assert.NotNull(antes);
        f.Tempo.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(HttpStatusCode.NoContent, (await c.B.Cliente.PostAsync(Rota(c.OcorrenciaId, "Senhas"), null)).StatusCode);
        Assert.Equal(antes, await HorarioAsync(c, "Senhas"));
        await CenarioAlerta.SilencioAsync();
        Assert.Single(c.EventosA.Passos);   // a repeticao nao notifica de novo
    }

    private static async Task<string?> HorarioAsync(CenarioAlerta c, string passo) =>
        (await c.V.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{c.OcorrenciaId}"))
            .GetProperty("passos").EnumerateArray().Single(p => p.GetProperty("passo").GetString() == passo)
            .GetProperty("concluidoEm").GetString();

    [Fact]
    public async Task Cinco_passos_encerram_a_ocorrencia()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        foreach (var p in new[] { "Banco", "CelularSeguro", "Operadora", "Senhas" })
        {
            Assert.Equal(HttpStatusCode.NoContent, (await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, p), null)).StatusCode);
            var estado = (await c.V.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{c.OcorrenciaId}")).GetProperty("estado").GetString();
            Assert.Equal("Aberta", estado);
        }
        Assert.Equal(HttpStatusCode.NoContent, (await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, "Bo"), null)).StatusCode);

        var d = await c.V.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{c.OcorrenciaId}");
        Assert.Equal("Encerrada", d.GetProperty("estado").GetString());
        Assert.Equal("encerrado", (await CenarioAlerta.EsperarAsync(c.EventosA.Encerrados)).Motivo);
        using var db = f.NovoDb();
        Assert.All(await db.Alertas.AsNoTracking().Where(a => a.OcorrenciaId == c.OcorrenciaId).ToListAsync(), a => Assert.Equal(EstadoAlerta.Encerrado, a.Estado));
        // ocorrencia encerrada nao aceita passo novo, mas repetir um concluido segue 204.
        Assert.Equal(HttpStatusCode.NoContent, (await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, "Bo"), null)).StatusCode);
    }

    [Fact]
    public async Task Quinto_passo_de_ocorrencia_do_chaveiro_publica_resolve()
    {
        var v = await f.NovoUsuarioAsync(); var g = await f.VincularGuardiaoAsync(v);
        using var escopo = f.Services.CreateScope();
        var svc = escopo.ServiceProvider.GetRequiredService<IOcorrenciaService>();
        var agora = f.Tempo.GetUtcNow().UtcDateTime;
        var criada = await svc.DispararAsync(new GatilhoChaveiro("chaveiro-ampara-aa0011", "chaveiro-ampara-aa0011-9", agora), v.UsuarioId, CancellationToken.None);
        f.Gateway.Limpar();

        foreach (var p in new[] { "Banco", "CelularSeguro", "Operadora", "Senhas", "Bo" })
            Assert.Equal(HttpStatusCode.NoContent, (await g.Cliente.PostAsync(Rota(criada.OcorrenciaId, p), null)).StatusCode);
        Assert.Equal(ComandoChaveiro.Resolve("chaveiro-ampara-aa0011-9"), Assert.Single(f.Gateway.Publicados).Cmd);
    }

    [Fact]
    public async Task Passo_em_ocorrencia_cancelada_409()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        await c.V.Cliente.PostAsync($"/api/v1/ocorrencias/{c.OcorrenciaId}/cancelar", null);
        var r = await c.A.Cliente.PostAsync(Rota(c.OcorrenciaId, "Banco"), null);
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("ocorrencia-nao-aberta", await CodigoDoErroAsync(r));
    }
}
