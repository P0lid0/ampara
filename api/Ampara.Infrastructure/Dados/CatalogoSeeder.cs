using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Infrastructure.Dados;

public static class CatalogoSeeder
{
    private static readonly JsonSerializerOptions Opcoes = new(JsonSerializerDefaults.Web);

    public static List<CatalogoConta> Ler(string caminhoJson) =>
        JsonSerializer.Deserialize<List<CatalogoConta>>(File.ReadAllText(caminhoJson), Opcoes) ?? [];

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
