using System.Text.RegularExpressions;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Chaveiros;

public sealed partial class ChaveiroService(IAmparaDb db, IChaveiroGateway gateway, IAcessoIndevido acessoIndevido, TimeProvider tempo) : IChaveiroService
{
    [GeneratedRegex("^[a-z0-9][a-z0-9-]{7,63}$")]
    private static partial Regex PadraoDeviceId();

    public async Task<Guid> ParearAsync(Guid usuarioId, string deviceId, CancellationToken ct)
    {
        deviceId ??= "";
        if (!PadraoDeviceId().IsMatch(deviceId)) throw new DominioException("device-id-invalido");
        if (await db.Chaveiros.AnyAsync(c => c.DeviceId == deviceId, ct)) throw new ConflitoException("chaveiro-ja-pareado");

        var c = Chaveiro.Parear(usuarioId, deviceId, tempo.GetUtcNow().UtcDateTime);
        db.Chaveiros.Add(c);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Corrida: outro pareamento do mesmo id entrou entre a checagem e a gravação (índice único).
            throw new ConflitoException("chaveiro-ja-pareado");
        }
        return c.Id;
    }

    public async Task<IReadOnlyList<ChaveiroDto>> ListarAsync(Guid usuarioId, CancellationToken ct)
    {
        var linhas = await db.Chaveiros.AsNoTracking()
            .Where(c => c.UsuarioId == usuarioId)
            .Select(c => new { c.DeviceId, c.Online, c.Bateria, c.VistoEm, c.PareadoEm })
            .ToListAsync(ct);
        // Ordena em memória: o SQLite dos testes não ordena data UTC de forma confiável no servidor.
        return linhas.OrderBy(c => c.PareadoEm)
            .Select(c => new ChaveiroDto(c.DeviceId, c.Online, c.Bateria, c.VistoEm))
            .ToList();
    }

    public async Task EnviarComandoAsync(Guid usuarioId, string deviceId, string cmd, CancellationToken ct)
    {
        var comando = (cmd ?? "").Trim().ToLowerInvariant() switch
        {
            "find" => ComandoChaveiro.Find(),
            "ping" => ComandoChaveiro.Ping(),
            "resolve" => throw new DominioException("cmd-nao-suportado"),   // entra na T11
            _ => throw new DominioException("cmd-invalido"),
        };

        var dono = await db.Chaveiros.AsNoTracking().Where(x => x.DeviceId == deviceId)
            .Select(x => (Guid?)x.UsuarioId).FirstOrDefaultAsync(ct)
            ?? throw new NaoEncontradoException("chaveiro-nao-encontrado");
        if (dono != usuarioId)
        {
            acessoIndevido.Registrar(dono, "recurso-de-outro-usuario");
            throw new AcessoNegadoException("chaveiro-de-outro-usuario");
        }
        await gateway.PublicarComandoAsync(deviceId, comando, ct);
    }
}
