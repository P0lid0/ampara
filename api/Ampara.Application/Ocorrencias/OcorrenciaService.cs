using Ampara.Application.Chaveiros;
using Ampara.Application.Comum;
using Ampara.Application.Contas;
using Ampara.Application.Cyber;
using Ampara.Application.Guardioes;
using Ampara.Domain;
using Ampara.Domain.Entidades;
using Ampara.Domain.Gatilhos;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Ocorrencias;

public sealed class OcorrenciaService(
    IAmparaDb db, IGuardiaoService guardioes, IContaService contas, IChaveiroGateway gateway,
    IAcessoIndevido acessoIndevido, TimeProvider tempo) : IOcorrenciaService
{
    public const int MaxListagem = 50;

    private DateTime Agora => tempo.GetUtcNow().UtcDateTime;

    public async Task<OcorrenciaCriada> DispararAsync(IGatilho gatilho, Guid vitimaId, CancellationToken ct)
    {
        var existente = await AbertaDaVitimaAsync(vitimaId, ct);
        if (existente is { } id) return new OcorrenciaCriada(id, false);

        var o = gatilho.CriarOcorrencia(vitimaId, Agora);
        db.Ocorrencias.Add(o);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Outra requisição abriu a ocorrência no meio (índice único parcial): solta a nossa e devolve a que ficou.
            db.Ocorrencias.Remove(o);
            if (await AbertaDaVitimaAsync(vitimaId, ct) is { } vencedora) return new OcorrenciaCriada(vencedora, false);
            throw;
        }
        return new OcorrenciaCriada(o.Id, true);
    }

    public async Task<OcorrenciaDto> ObterAsync(Ator ator, Guid id, CancellationToken ct)
    {
        var o = await CarregarAsync(id, ct);
        var comMomento = await AutorizarLeituraAsync(ator, o, ct);
        return OcorrenciaMapa.ParaDto(o, comMomento, [], await ContasDaVitimaAsync(o.UsuarioId, ct));
    }

    public async Task<IReadOnlyList<OcorrenciaDto>> ListarAsync(Ator ator, CancellationToken ct)
    {
        var donos = new List<Guid> { ator.UsuarioId };
        if (ator.Escopo == Escopos.Usuario)
            donos.AddRange(await db.Guardioes.AsNoTracking().Where(g => g.GuardiaoUsuarioId == ator.UsuarioId).Select(g => g.UsuarioId).ToListAsync(ct));

        // Datas ordenadas em memória: o SQLite dos testes não ordena data UTC de forma confiável no servidor.
        var recentes = (await db.Ocorrencias.AsNoTracking().Where(o => donos.Contains(o.UsuarioId))
                .Select(o => new { o.Id, o.IniciadaEm }).ToListAsync(ct))
            .OrderByDescending(x => x.IniciadaEm).Take(MaxListagem).Select(x => x.Id).ToList();
        if (recentes.Count == 0) return [];

        var lista = await db.Ocorrencias.AsNoTracking().Include(o => o.Passos).Where(o => recentes.Contains(o.Id)).ToListAsync(ct);
        var cacheContas = new Dictionary<Guid, IReadOnlyList<ContaOcorrenciaDto>>();
        var saida = new List<OcorrenciaDto>(lista.Count);
        foreach (var o in lista.OrderByDescending(x => x.IniciadaEm))
        {
            if (!cacheContas.TryGetValue(o.UsuarioId, out var cs)) cacheContas[o.UsuarioId] = cs = await ContasDaVitimaAsync(o.UsuarioId, ct);
            saida.Add(OcorrenciaMapa.ParaDto(o, o.UsuarioId == ator.UsuarioId, [], cs));
        }
        return saida;
    }

    public async Task MarcarMomentoAsync(Ator ator, Guid id, DateTime em, double lat, double lng, CancellationToken ct)
    {
        var o = await CarregarAsync(id, ct, rastrear: true);
        ExigirDono(ator, o);
        o.MarcarMomento(em, lat, lng, Agora);
        await db.SaveChangesAsync(ct);
    }

    public async Task CancelarAsync(Ator ator, Guid id, CancellationToken ct)
    {
        var o = await CarregarAsync(id, ct, rastrear: true);
        ExigirDono(ator, o);
        o.Cancelar(Agora);
        await db.SaveChangesAsync(ct);
        if (o is { Origem: OrigemGatilho.Chaveiro, ChaveiroDeviceId: { } device, ChaveiroAlertId: { } alerta })
            await gateway.PublicarComandoAsync(device, ComandoChaveiro.Resolve(alerta), ct);
    }

    public async Task CancelarPorChaveiroAsync(string deviceId, string alertId, CancellationToken ct)
    {
        var o = await db.Ocorrencias.Include(x => x.Passos)
            .FirstOrDefaultAsync(x => x.ChaveiroDeviceId == deviceId && x.ChaveiroAlertId == alertId && x.Estado == EstadoOcorrencia.Aberta, ct);
        if (o is null) return;
        o.Cancelar(Agora);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Guid?> AbertaDaVitimaAsync(Guid vitimaId, CancellationToken ct) =>
        await db.Ocorrencias.AsNoTracking().Where(o => o.UsuarioId == vitimaId && o.Estado == EstadoOcorrencia.Aberta)
            .Select(o => (Guid?)o.Id).FirstOrDefaultAsync(ct);

    private async Task<Ocorrencia> CarregarAsync(Guid id, CancellationToken ct, bool rastrear = false)
    {
        var q = rastrear ? db.Ocorrencias.AsQueryable() : db.Ocorrencias.AsNoTracking();
        return await q.Include(o => o.Passos).FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NaoEncontradoException("ocorrencia-nao-encontrada");
    }

    private void ExigirDono(Ator ator, Ocorrencia o)
    {
        if (ator.UsuarioId == o.UsuarioId) return;
        acessoIndevido.Registrar(o.UsuarioId, "recurso-de-outro-usuario");
        throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
    }

    /// <summary>Dono (qualquer escopo) lê tudo; guardião (escopo usuario) lê sem o momento. Devolve se o momento pode ir junto.</summary>
    private async Task<bool> AutorizarLeituraAsync(Ator ator, Ocorrencia o, CancellationToken ct)
    {
        if (ator.UsuarioId == o.UsuarioId) return true;
        if (ator.Escopo == Escopos.Usuario && await guardioes.EhGuardiaoDeAsync(ator.UsuarioId, o.UsuarioId, ct)) return false;
        acessoIndevido.Registrar(o.UsuarioId, "recurso-de-outro-usuario");
        throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
    }

    private async Task<IReadOnlyList<ContaOcorrenciaDto>> ContasDaVitimaAsync(Guid vitimaId, CancellationToken ct) =>
        (await contas.ListarVinculadasAsync(vitimaId, ct)).Select(c => new ContaOcorrenciaDto(c.Nome, c.Tipo, c.Telefone, c.Link)).ToList();
}
