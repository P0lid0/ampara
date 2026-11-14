using Ampara.Domain.Entidades;
using Ampara.Infrastructure.Dados;
using Ampara.Tests.Infra;

namespace Ampara.Tests;

public class CatalogoSeedTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private static readonly string CaminhoReal = Path.Combine(AppContext.BaseDirectory, "Dados", "catalogo-contas.json");

    private static List<CatalogoConta> LerSeedReal() => CatalogoSeeder.Ler(CaminhoReal);

    [Fact]
    public void Seed_real_e_coerente()
    {
        var itens = LerSeedReal();
        Assert.True(itens.Count >= 13);
        Assert.Equal(itens.Count, itens.Select(i => i.Id).Distinct().Count());
        Assert.All(itens, i =>
        {
            Assert.StartsWith("https://", i.Link);
            if (i.Telefone is not null)
            {
                Assert.Matches(@"^[0-9+() \-]{8,20}$", i.Telefone);
                Assert.NotNull(i.ConferidoEm);
            }
            if (i.ConferidoEm is not null) Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", i.ConferidoEm);
        });
        Assert.Contains(itens, i => i.Tipo == "operadora");
        foreach (var id in new[] { "bb", "caixa", "itau", "bradesco", "santander", "nubank", "inter", "c6", "mercadopago", "picpay", "vivo", "claro", "tim" })
            Assert.Contains(itens, i => i.Id == id);
    }

    [Fact]
    public async Task Seeder_e_idempotente()
    {
        using var db = f.NovoDb();
        await CatalogoSeeder.SemearAsync(db, CaminhoReal, CancellationToken.None);
        var n1 = db.Catalogo.Count();
        await CatalogoSeeder.SemearAsync(db, CaminhoReal, CancellationToken.None);
        Assert.Equal(n1, db.Catalogo.Count());
        Assert.True(n1 >= 13);
    }
}
