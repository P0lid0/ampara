using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Ampara.Tests.Infra;

namespace Ampara.Tests;

public class SaudeTests
{
    private static async Task<(HttpStatusCode, JsonElement)> ChamarAsync(AmparaFactory f)
    {
        var r = await f.CreateClient().GetAsync("/health");
        return (r.StatusCode, await r.Content.ReadFromJsonAsync<JsonElement>());
    }

    [Fact]
    public async Task Health_ok_com_mqtt_conectado()
    {
        using var f = new AmparaFactory();
        f.Gateway.Conectado = true;
        var (st, j) = await ChamarAsync(f);
        Assert.Equal(HttpStatusCode.OK, st);
        Assert.Equal("ok", j.GetProperty("status").GetString());
        Assert.True(j.GetProperty("mqtt").GetBoolean());
        Assert.True(j.GetProperty("db").GetBoolean());
    }

    [Fact]
    public async Task Health_degradado_com_mqtt_fora_mas_200()
    {
        using var f = new AmparaFactory();
        f.Gateway.Conectado = false;
        var (st, j) = await ChamarAsync(f);
        Assert.Equal(HttpStatusCode.OK, st);
        Assert.Equal("degradado", j.GetProperty("status").GetString());
        Assert.False(j.GetProperty("mqtt").GetBoolean());
        Assert.True(j.GetProperty("db").GetBoolean());
    }

    [Fact]
    public async Task Health_503_falha_quando_o_banco_nao_responde()
    {
        using var f = new AmparaFactory();
        f.Sonda.BancoOk = false;
        var r = await f.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, r.StatusCode);
        var corpo = await r.Content.ReadAsStringAsync();
        var j = JsonDocument.Parse(corpo).RootElement;
        Assert.Equal("falha", j.GetProperty("status").GetString());
        Assert.False(j.GetProperty("db").GetBoolean());
        Assert.DoesNotContain("Exception", corpo);
        Assert.DoesNotContain("   at ", corpo);
    }

    [Fact]
    public async Task Health_fica_na_raiz_e_nao_em_api_v1()
    {
        using var f = new AmparaFactory();
        var c = f.CreateClient();   // sem token
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/v1/health")).StatusCode);
    }

    [Fact]
    public async Task Sonda_real_responde_ok_com_o_banco_de_teste()
    {
        using var f = new AmparaFactory();
        using var escopo = f.Services.CreateScope();
        var sonda = new Ampara.Infrastructure.SondaSaude(escopo.ServiceProvider.GetRequiredService<IServiceScopeFactory>());
        Assert.True(await sonda.BancoOkAsync(CancellationToken.None));
    }
}
