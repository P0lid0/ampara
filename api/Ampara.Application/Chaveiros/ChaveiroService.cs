using System.Text.RegularExpressions;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain;
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
            // Só vira 409 se o id foi de fato pareado por outro entre a checagem e a gravação (índice único).
            // Qualquer outra falha (FK, timeout, conexão) sobe com a exceção original.
            if (await db.Chaveiros.AsNoTracking().AnyAsync(x => x.DeviceId == deviceId, ct))
                throw new ConflitoException("chaveiro-ja-pareado");
            throw;
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
        var nome = (cmd ?? "").Trim().ToLowerInvariant();
        if (nome is not ("find" or "ping" or "resolve")) throw new DominioException("cmd-invalido");

        var dono = await db.Chaveiros.AsNoTracking().Where(x => x.DeviceId == deviceId)
            .Select(x => (Guid?)x.UsuarioId).FirstOrDefaultAsync(ct)
            ?? throw new NaoEncontradoException("chaveiro-nao-encontrado");
        if (dono != usuarioId)
        {
            acessoIndevido.Registrar(dono, "recurso-de-outro-usuario");
            throw new AcessoNegadoException("chaveiro-de-outro-usuario");
        }

        ComandoChaveiro comando;
        if (nome == "resolve")
        {
            // Resolve só vale com um alerta em curso: usa o alertId da ocorrência Aberta deste chaveiro.
            var alerta = await db.Ocorrencias.AsNoTracking()
                .Where(o => o.UsuarioId == usuarioId && o.ChaveiroDeviceId == deviceId && o.Estado == EstadoOcorrencia.Aberta)
                .Select(o => o.ChaveiroAlertId).FirstOrDefaultAsync(ct);
            if (alerta is null) throw new ConflitoException("sem-alerta-ativo");
            comando = ComandoChaveiro.Resolve(alerta);
        }
        else comando = nome == "find" ? ComandoChaveiro.Find() : ComandoChaveiro.Ping();
        await gateway.PublicarComandoAsync(deviceId, comando, ct);
    }
}
