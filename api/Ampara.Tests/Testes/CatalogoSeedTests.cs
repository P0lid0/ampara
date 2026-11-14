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
        Assert.True(itens.Count >= CatalogoSeeder.MinimoEsperado);
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
        Assert.True(n1 >= CatalogoSeeder.MinimoEsperado);
    }

    [Fact]
    public async Task Seeder_atualiza_item_existente_e_rejeita_id_repetido()
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "seed-tmp-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var a = Path.Combine(dir, "a.json");
            File.WriteAllText(a, """[{"id":"x","nome":"Antigo","tipo":"banco","telefone":null,"link":"https://x.invalid/","conferidoEm":null}]""");
            using var db = f.NovoDb();
            await CatalogoSeeder.SemearAsync(db, a, CancellationToken.None);
            File.WriteAllText(a, """[{"id":"x","nome":"Novo","tipo":"banco","telefone":"3003 4070","link":"https://x.invalid/","conferidoEm":"2026-11-14"}]""");
            await CatalogoSeeder.SemearAsync(db, a, CancellationToken.None);
            var x = db.Catalogo.Single(c => c.Id == "x");
            Assert.Equal("Novo", x.Nome);
            Assert.Equal("3003 4070", x.Telefone);

            var b = Path.Combine(dir, "b.json");
            File.WriteAllText(b, """[{"id":"y","nome":"A","tipo":"banco","link":"https://y.invalid/"},{"id":"y","nome":"B","tipo":"banco","link":"https://y.invalid/"}]""");
            Assert.Throws<InvalidOperationException>(() => CatalogoSeeder.Ler(b));
        }
        finally { Directory.Delete(dir, true); }
    }
}
