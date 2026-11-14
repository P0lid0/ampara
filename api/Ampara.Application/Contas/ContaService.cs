using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Contas;

public sealed class ContaService(IAmparaDb db, ICifrador cifrador, TimeProvider tempo) : IContaService
{
    public async Task<IReadOnlyList<CatalogoConta>> ListarCatalogoAsync(CancellationToken ct) =>
        (await db.Catalogo.AsNoTracking().ToListAsync(ct)).OrderBy(c => c.Tipo, StringComparer.Ordinal).ThenBy(c => c.Nome, StringComparer.Ordinal).ToList();

    public async Task<Guid> VincularAsync(Guid usuarioId, string catalogoId, CancellationToken ct)
    {
        catalogoId = (catalogoId ?? "").Trim();
        if (catalogoId.Length == 0 || !await db.Catalogo.AnyAsync(c => c.Id == catalogoId, ct))
            throw new NaoEncontradoException("conta-desconhecida");

        // O slug é cifrado com nonce aleatório: a duplicidade só se vê decifrando as contas do usuário.
        return await db.TransacaoAsync(async () =>
        {
            await db.TravarPorChaveAsync("conta:" + usuarioId, ct);
            var cifradas = await db.Contas.AsNoTracking().Where(c => c.UsuarioId == usuarioId).Select(c => c.CatalogoIdCifrado).ToListAsync(ct);
            if (cifradas.Any(x => cifrador.Decifrar(x) == catalogoId)) throw new ConflitoException("conta-ja-vinculada");
            var conta = ContaVinculada.Criar(usuarioId, cifrador.Cifrar(catalogoId), tempo.GetUtcNow().UtcDateTime);
            db.Contas.Add(conta);
            await db.SaveChangesAsync(ct);
            return conta.Id;
        }, ct);
    }

    public async Task<IReadOnlyList<ContaVinculadaDto>> ListarVinculadasAsync(Guid usuarioId, CancellationToken ct)
    {
        var contas = await db.Contas.AsNoTracking().Where(c => c.UsuarioId == usuarioId)
            .Select(c => new { c.Id, c.CatalogoIdCifrado, c.CriadoEm }).ToListAsync(ct);
        if (contas.Count == 0) return [];
        var catalogo = await db.Catalogo.AsNoTracking().ToDictionaryAsync(c => c.Id, ct);
        return contas.OrderBy(c => c.CriadoEm)
            .Select(c => (c.Id, Item: catalogo.GetValueOrDefault(cifrador.Decifrar(c.CatalogoIdCifrado))))
            .Where(x => x.Item is not null)
            .Select(x => new ContaVinculadaDto(x.Id, x.Item!.Nome, x.Item.Tipo, x.Item.Telefone, x.Item.Link))
            .ToList();
    }
}
