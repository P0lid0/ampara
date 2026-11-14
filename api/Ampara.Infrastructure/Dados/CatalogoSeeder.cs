using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Infrastructure.Dados;

public static class CatalogoSeeder
{
    private static readonly JsonSerializerOptions Opcoes = new(JsonSerializerDefaults.Web);

    /// <summary>Quantidade minima de itens do catalogo curado (10 bancos e 3 operadoras).</summary>
    public const int MinimoEsperado = 13;

    public static List<CatalogoConta> Ler(string caminhoJson)
    {
        var itens = JsonSerializer.Deserialize<List<CatalogoConta>>(File.ReadAllText(caminhoJson), Opcoes) ?? [];
        if (itens.Any(i => string.IsNullOrWhiteSpace(i.Id)))
            throw new InvalidOperationException("Catalogo com item sem id.");
        var repetido = itens.GroupBy(i => i.Id).FirstOrDefault(g => g.Count() > 1);
        if (repetido is not null)
            throw new InvalidOperationException($"Catalogo com id repetido: {repetido.Key}.");
        return itens;
    }

    /// <summary>Upsert idempotente por Id: roda quantas vezes quiser sem duplicar.</summary>
    public static async Task SemearAsync(IAmparaDb db, string caminhoJson, CancellationToken ct)
    {
        var itens = Ler(caminhoJson);
        var existentes = await db.Catalogo.ToDictionaryAsync(c => c.Id, ct);
        foreach (var i in itens)
        {
            if (existentes.TryGetValue(i.Id, out var atual))
            {
                atual.Nome = i.Nome; atual.Tipo = i.Tipo; atual.Telefone = i.Telefone; atual.Link = i.Link; atual.ConferidoEm = i.ConferidoEm;
            }
            else db.Catalogo.Add(i);
        }
        await db.SaveChangesAsync(ct);
    }
}
