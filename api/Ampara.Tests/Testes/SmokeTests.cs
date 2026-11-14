using Ampara.Tests.Infra;

namespace Ampara.Tests;

public class SmokeTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    [Fact]
    public async Task Openapi_responde_200_e_lista_caminhos()
    {
        var r = await f.CreateClient().GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("\"paths\"", await r.Content.ReadAsStringAsync());
    }
}
