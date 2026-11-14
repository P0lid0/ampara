using Ampara.Domain.Comum;
using Ampara.Infrastructure.Dados;

namespace Ampara.Tests;

public class DelegaciaTests
{
    private static string Fixture => Path.Combine(AppContext.BaseDirectory, "Fixtures", "delegacias-teste.json");

    [Fact]
    public void Mais_proxima_de_pinheiros_e_a_A()
    {
        var locator = new DelegaciaJsonLocator(Fixture);
        Assert.Equal("Delegacia Teste A", locator.MaisProxima(-23.5672490, -46.7019515)!.Nome);
    }

    [Fact]
    public void Mais_proxima_da_se_e_a_B_e_do_extremo_sul_e_a_C()
    {
        var locator = new DelegaciaJsonLocator(Fixture);
        Assert.Equal("Delegacia Teste B", locator.MaisProxima(-23.5510, -46.6340)!.Nome);
        Assert.Equal("Delegacia Teste C", locator.MaisProxima(-23.7000, -46.7000)!.Nome);
    }

    [Fact]
    public void Arquivo_ausente_ou_invalido_nao_tem_delegacia()
    {
        Assert.Null(new DelegaciaJsonLocator(Path.Combine(AppContext.BaseDirectory, "nao-existe.json")).MaisProxima(-23.56, -46.70));
        var ruim = Path.Combine(Path.GetTempPath(), $"deleg-{Guid.NewGuid():N}.json");
        File.WriteAllText(ruim, "{ isto nao e json");
        try { Assert.Null(new DelegaciaJsonLocator(ruim).MaisProxima(-23.56, -46.70)); }
        finally { File.Delete(ruim); }
    }

    [Fact]
    public void Coordenada_nao_finita_nao_tem_delegacia() =>
        Assert.Null(new DelegaciaJsonLocator(Fixture).MaisProxima(double.NaN, -46.70));

    [Fact]
    public void Arquivo_real_tem_delegacias_com_coordenadas_dentro_de_sp()
    {
        var caminho = Path.Combine(AppContext.BaseDirectory, "Dados", "delegacias.json");
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(caminho));
        var itens = doc.RootElement.EnumerateArray().ToList();
        Assert.True(itens.Count >= 10, $"so {itens.Count} delegacias");
        foreach (var i in itens)
        {
            Assert.False(string.IsNullOrWhiteSpace(i.GetProperty("nome").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(i.GetProperty("endereco").GetString()));
            Assert.NotEqual(AreaMapa.Fora, AreaMapa.AreaId(i.GetProperty("lat").GetDouble(), i.GetProperty("lng").GetDouble()));
        }
        Assert.Equal(itens.Count, new DelegaciaJsonLocator(caminho).Total);
    }
}
