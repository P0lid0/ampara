using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Alertas;
using Ampara.Domain;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests;

public class EscaladaTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static readonly TimeSpan Seg = TimeSpan.FromSeconds(1);

    private async Task<List<(Guid Id, EstadoAlerta Estado, Guid GuardiaoId, DateTime DisparadoEm, DateTime? CienteEm)>> AlertasAsync(Guid ocorrenciaId)
    {
        using var db = f.NovoDb();
        return (await db.Alertas.AsNoTracking().Where(a => a.OcorrenciaId == ocorrenciaId).ToListAsync())
            .OrderBy(a => a.DisparadoEm).Select(a => (a.Id, a.Estado, a.GuardiaoId, a.DisparadoEm, a.CienteEm)).ToList();
    }

    [Fact]
    public async Task Disparo_alerta_o_guardiao_1_com_nome_da_vitima()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        var m = await CenarioAlerta.EsperarAsync(c.EventosA.Disparados);
        Assert.Equal("Vitima Teste", m.VitimaNome);
        Assert.Equal("web", m.Origem);
        Assert.Equal(c.OcorrenciaId, m.OcorrenciaId);
        await CenarioAlerta.SilencioAsync();
        Assert.Empty(c.EventosB.Disparados);
        Assert.Empty(c.EventosC.Disparados);
    }

    [Fact]
    public async Task Escalada_so_aos_60_segundos_e_um_por_vez()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        await CenarioAlerta.EsperarAsync(c.EventosA.Disparados);

        f.Tempo.Advance(59 * Seg);
        Assert.Equal(0, await c.ProcessarAsync());
        f.Tempo.Advance(Seg);
        Assert.Equal(1, await c.ProcessarAsync());
        var paraB = await CenarioAlerta.EsperarAsync(c.EventosB.Disparados);
        Assert.Equal("Vitima Teste", paraB.VitimaNome);
        var escA = await CenarioAlerta.EsperarAsync(c.EventosA.Escalados);
        Assert.Equal(c.OcorrenciaId, escA.OcorrenciaId);
        Assert.Equal(c.GuardiaoB, escA.ParaGuardiaoId);
        Assert.Equal(paraB.AlertaId, escA.AlertaId);

        f.Tempo.Advance(60 * Seg);
        Assert.Equal(1, await c.ProcessarAsync());
        await CenarioAlerta.EsperarAsync(c.EventosC.Disparados);
        var escA2 = await CenarioAlerta.EsperarAsync(c.EventosA.Escalados, 2);
        var escB = await CenarioAlerta.EsperarAsync(c.EventosB.Escalados);
        Assert.Equal(c.GuardiaoC, escA2.ParaGuardiaoId);
        Assert.Equal(c.GuardiaoC, escB.ParaGuardiaoId);
        Assert.Equal(c.OcorrenciaId, escB.OcorrenciaId);

        f.Tempo.Advance(60 * Seg);
        Assert.Equal(0, await c.ProcessarAsync());   // esgotada
        await CenarioAlerta.SilencioAsync();
        Assert.Single(c.EventosA.Disparados); Assert.Single(c.EventosB.Disparados); Assert.Single(c.EventosC.Disparados);
        Assert.Equal(2, c.EventosA.Escalados.Count); Assert.Single(c.EventosB.Escalados); Assert.Empty(c.EventosC.Escalados);
        var alertas = await AlertasAsync(c.OcorrenciaId);
        Assert.Equal(3, alertas.Count);
        Assert.All(alertas, a => Assert.Equal(EstadoAlerta.Ativo, a.Estado));
    }

    [Fact]
    public async Task Ciente_para_a_escalada_e_encerra_os_outros()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        f.Tempo.Advance(60 * Seg);
        Assert.Equal(1, await c.ProcessarAsync());
        var alertaB = (await CenarioAlerta.EsperarAsync(c.EventosB.Disparados)).AlertaId;
        f.Tempo.Advance(10 * Seg);

        Assert.Equal(HttpStatusCode.NoContent, (await c.B.Cliente.PostAsync($"/api/v1/alertas/{alertaB}/ciente", null)).StatusCode);
        var cienteEm = f.Tempo.GetUtcNow().UtcDateTime;
        f.Tempo.Advance(120 * Seg);
        Assert.Equal(0, await c.ProcessarAsync());

        Assert.Equal("ciente", (await CenarioAlerta.EsperarAsync(c.EventosA.Encerrados)).Motivo);
        await CenarioAlerta.SilencioAsync();
        Assert.Empty(c.EventosB.Encerrados);
        Assert.Empty(c.EventosC.Disparados);
        var alertas = await AlertasAsync(c.OcorrenciaId);
        Assert.Equal(EstadoAlerta.Encerrado, alertas[0].Estado);
        Assert.Equal(EstadoAlerta.Ciente, alertas[1].Estado);
        Assert.Equal(cienteEm, alertas[1].CienteEm);
    }

    [Fact]
    public async Task Ciente_repetido_204_e_de_outro_guardiao_403()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        var alertaA = (await CenarioAlerta.EsperarAsync(c.EventosA.Disparados)).AlertaId;

        f.Acesso.Limpar();
        Assert.Equal(HttpStatusCode.Forbidden, (await c.B.Cliente.PostAsync($"/api/v1/alertas/{alertaA}/ciente", null)).StatusCode);
        Assert.Empty(f.Acesso.Chamadas);   // guardiao legitimo da vitima nao e acesso indevido
        var estranho = await f.NovoUsuarioAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await estranho.Cliente.PostAsync($"/api/v1/alertas/{alertaA}/ciente", null)).StatusCode);
        Assert.Equal("recurso-de-outro-usuario", Assert.Single(f.Acesso.Chamadas).Campo);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.Emergencia.PostAsync($"/api/v1/alertas/{alertaA}/ciente", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.A.Cliente.PostAsync($"/api/v1/alertas/{Guid.NewGuid()}/ciente", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await c.A.Cliente.PostAsync($"/api/v1/alertas/{alertaA}/ciente", null)).StatusCode);
        var primeira = (await AlertasAsync(c.OcorrenciaId))[0].CienteEm;
        Assert.NotNull(primeira);
        f.Tempo.Advance(30 * Seg);
        Assert.Equal(HttpStatusCode.NoContent, (await c.A.Cliente.PostAsync($"/api/v1/alertas/{alertaA}/ciente", null)).StatusCode);
        Assert.Equal(primeira, (await AlertasAsync(c.OcorrenciaId))[0].CienteEm);
    }

    [Fact]
    public async Task Alertas_ativos_do_guardiao()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        var disparado = await CenarioAlerta.EsperarAsync(c.EventosA.Disparados);

        var lista = await c.A.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/alertas/ativos");
        var item = Assert.Single(lista.EnumerateArray());
        Assert.Equal(disparado.AlertaId, item.GetProperty("alertaId").GetGuid());
        Assert.Equal(c.OcorrenciaId, item.GetProperty("ocorrenciaId").GetGuid());
        Assert.Equal("Vitima Teste", item.GetProperty("vitimaNome").GetString());
        Assert.Equal("web", item.GetProperty("origem").GetString());
        Assert.EndsWith("Z", item.GetProperty("em").GetString());
        Assert.Equal(0, (await c.B.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/alertas/ativos")).GetArrayLength());

        await c.A.Cliente.PostAsync($"/api/v1/alertas/{disparado.AlertaId}/ciente", null);
        Assert.Equal(0, (await c.A.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/alertas/ativos")).GetArrayLength());
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/alertas/ativos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.Emergencia.GetAsync("/api/v1/alertas/ativos")).StatusCode);
    }

    [Fact]
    public async Task Detalhe_da_ocorrencia_lista_os_alertas_com_enviadoEm_e_cienteEm()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        f.Tempo.Advance(60 * Seg);
        await c.ProcessarAsync();
        var alertaB = (await CenarioAlerta.EsperarAsync(c.EventosB.Disparados)).AlertaId;

        var d = await c.V.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{c.OcorrenciaId}");
        var alertas = d.GetProperty("alertas").EnumerateArray().ToList();
        Assert.Equal(2, alertas.Count);
        var linhas = await AlertasAsync(c.OcorrenciaId);
        Assert.Equal(c.GuardiaoA, alertas[0].GetProperty("guardiaoId").GetGuid());
        Assert.Equal(c.GuardiaoB, alertas[1].GetProperty("guardiaoId").GetGuid());
        Assert.Equal(linhas[1].Id, alertas[1].GetProperty("alertaId").GetGuid());
        Assert.Equal(linhas[0].DisparadoEm, alertas[0].GetProperty("enviadoEm").GetDateTime().ToUniversalTime());
        Assert.All(alertas, a => Assert.Equal(JsonValueKind.Null, a.GetProperty("cienteEm").ValueKind));

        await c.B.Cliente.PostAsync($"/api/v1/alertas/{alertaB}/ciente", null);
        var depois = (await c.V.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{c.OcorrenciaId}")).GetProperty("alertas").EnumerateArray().ToList();
        Assert.Equal(JsonValueKind.Null, depois[0].GetProperty("cienteEm").ValueKind);
        Assert.EndsWith("Z", depois[1].GetProperty("cienteEm").GetString());
    }

    [Fact]
    public async Task Cancelar_encerra_alertas_com_motivo_cancelado_e_nao_escala_mais()
    {
        await using var c = await CenarioAlerta.CriarAsync(f);
        f.Tempo.Advance(60 * Seg);
        await c.ProcessarAsync();
        await CenarioAlerta.EsperarAsync(c.EventosB.Disparados);

        Assert.Equal(HttpStatusCode.NoContent, (await c.V.Cliente.PostAsync($"/api/v1/ocorrencias/{c.OcorrenciaId}/cancelar", null)).StatusCode);
        Assert.Equal("cancelado", (await CenarioAlerta.EsperarAsync(c.EventosA.Encerrados)).Motivo);
        Assert.Equal("cancelado", (await CenarioAlerta.EsperarAsync(c.EventosB.Encerrados)).Motivo);
        Assert.All(await AlertasAsync(c.OcorrenciaId), a => Assert.Equal(EstadoAlerta.Encerrado, a.Estado));

        f.Tempo.Advance(300 * Seg);
        Assert.Equal(0, await c.ProcessarAsync());
        await CenarioAlerta.SilencioAsync();
        Assert.Empty(c.EventosC.Disparados);
        Assert.Equal(0, (await c.A.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/alertas/ativos")).GetArrayLength());
    }

    [Fact]
    public async Task Vitima_sem_guardioes_nao_gera_alerta_nem_escala()
    {
        var sozinha = await f.NovoUsuarioAsync();
        await sozinha.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = "654321", palavraSecreta = "outra-palavra" });   // SINTETICO
        var em = await f.ClienteEmergenciaAsync(sozinha.Email, "654321", "outra-palavra");
        var r = await em.PostAsJsonAsync("/api/v1/ocorrencias/gatilho", new { origem = "web" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var id = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ocorrenciaId").GetGuid();
        try
        {
            f.Tempo.Advance(120 * Seg);
            using var escopo = f.Services.CreateScope();
            Assert.Equal(0, await escopo.ServiceProvider.GetRequiredService<IEscalonamento>().ProcessarVencidosAsync(CancellationToken.None));
            Assert.Empty(await AlertasAsync(id));
        }
        finally { await em.PostAsync($"/api/v1/ocorrencias/{id}/cancelar", null); }
    }
}
