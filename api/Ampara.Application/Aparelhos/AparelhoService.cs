using Ampara.Application.Comum;
using Ampara.Domain.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Aparelhos;

public sealed class AparelhoService(IAmparaDb db, ICifrador cifrador, TimeProvider tempo) : IAparelhoService
{
    private const int TextoMaximo = 60;

    public async Task<AparelhoCriadoDto> CriarAsync(Guid usuarioId, string imei, string marca, string modelo, CancellationToken ct)
    {
        // O IMEI nunca vai para mensagem de exceção nem para log.
        var imeiNorm = Imei.Normalizar(imei);
        if (!Imei.Valido(imeiNorm)) throw new DominioException("imei-invalido");
        marca = (marca ?? "").Trim();
        modelo = (modelo ?? "").Trim();
        if (marca.Length == 0) throw new DominioException("marca-obrigatoria");
        if (marca.Length > TextoMaximo) throw new DominioException("marca-longa");
        if (modelo.Length == 0) throw new DominioException("modelo-obrigatorio");
        if (modelo.Length > TextoMaximo) throw new DominioException("modelo-longo");

        var final = imeiNorm[^4..];
        var a = Aparelho.Criar(usuarioId, cifrador.Cifrar(imeiNorm), final, marca, modelo, tempo.GetUtcNow().UtcDateTime);
        db.Aparelhos.Add(a);
        await db.SaveChangesAsync(ct);
        return new AparelhoCriadoDto(a.Id, final);
    }

    public async Task<IReadOnlyList<AparelhoDto>> ListarAsync(Guid usuarioId, CancellationToken ct)
    {
        var linhas = await db.Aparelhos.AsNoTracking()
            .Where(a => a.UsuarioId == usuarioId)
            .Select(a => new { a.Id, a.Marca, a.Modelo, a.ImeiFinal, a.CriadoEm })
            .ToListAsync(ct);
        // Ordena em memória: o SQLite dos testes não ordena data UTC de forma confiável no servidor.
        return linhas.OrderByDescending(a => a.CriadoEm)
            .Select(a => new AparelhoDto(a.Id, a.Marca, a.Modelo, new string('*', 11) + a.ImeiFinal))
            .ToList();
    }

    public async Task<string?> ImeiCifradoMaisRecenteAsync(Guid usuarioId, CancellationToken ct)
    {
        var linhas = await db.Aparelhos.AsNoTracking()
            .Where(a => a.UsuarioId == usuarioId)
            .Select(a => new { a.ImeiCifrado, a.CriadoEm })
            .ToListAsync(ct);
        return linhas.OrderByDescending(a => a.CriadoEm).Select(a => a.ImeiCifrado).FirstOrDefault();
    }
}
