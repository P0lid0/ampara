using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Domain.Comum;
using Ampara.Tests.Infra;

namespace Ampara.Tests;

public class CamadaTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    [Theory]
    [InlineData("delegacias", 10)]
    [InlineData("estacoes", 5)]
    [InlineData("pm", 5)]
    public async Task Camadas_publicas_devolvem_nome_lat_lng_dentro_de_sp(string tipo, int minimo)
    {
        var r = await f.CreateClient().GetAsync($"/api/v1/camadas/{tipo}");   // sem token
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var itens = (await r.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.True(itens.Count >= minimo, $"{tipo}: so {itens.Count} itens");
        foreach (var i in itens)
        {
            Assert.Equal(["lat", "lng", "nome"], i.EnumerateObject().Select(p => p.Name).Order().ToArray());
            Assert.False(string.IsNullOrWhiteSpace(i.GetProperty("nome").GetString()));
            Assert.NotEqual(AreaMapa.Fora, AreaMapa.AreaId(i.GetProperty("lat").GetDouble(), i.GetProperty("lng").GetDouble()));
        }
    }

    [Fact]
    public async Task Camada_desconhecida_404_com_codigo()
    {
        var r = await f.CreateClient().GetAsync("/api/v1/camadas/hospitais");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        Assert.Equal("camada-desconhecida", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
    }
}
