using Ampara.Application.Alertas;
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
    IAcessoIndevido acessoIndevido, IEscalonamento escalonamento, IGuardiaoNotificador notificador, TimeProvider tempo) : IOcorrenciaService
{
    public const int MaxListagem = 50;

    private DateTime Agora => tempo.GetUtcNow().UtcDateTime;

    public async Task<OcorrenciaCriada> DispararAsync(IGatilho gatilho, Guid vitimaId, CancellationToken ct)
    {
        var existente = await AbertaDaVitimaAsync(vitimaId, ct);
        if (existente is { } id) return await ReaproveitarAsync(gatilho, id, ct);

        var o = gatilho.CriarOcorrencia(vitimaId, Agora);
        db.Ocorrencias.Add(o);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Outra requisição abriu a ocorrência no meio (índice único parcial): solta a nossa e devolve a que ficou.
            db.Ocorrencias.Remove(o);
            if (await AbertaDaVitimaAsync(vitimaId, ct) is { } vencedora) return await ReaproveitarAsync(gatilho, vencedora, ct);
            throw;
        }
        // Com janela de cancelamento (impacto) o alerta só sai quando ela fecha, pelo ProcessarVencidosAsync.
        if (o.AlertasLiberadosEm is not { } liberadoEm || liberadoEm <= Agora) await escalonamento.IniciarAsync(o.Id, ct);
        return new OcorrenciaCriada(o.Id, true);
    }

    /// <summary>Devolve a ocorrência aberta e deixa o gatilho se ligar a ela (o chaveiro grava deviceId e alertId).</summary>
    private async Task<OcorrenciaCriada> ReaproveitarAsync(IGatilho gatilho, Guid id, CancellationToken ct)
    {
        if (gatilho is GatilhoChaveiro or GatilhoImpacto)
        {
            var aberta = await db.Ocorrencias.FirstAsync(o => o.Id == id, ct);
            gatilho.Reaproveitar(aberta);
            await db.SaveChangesAsync(ct);
        }
        return new OcorrenciaCriada(id, false);
    }

    public async Task<OcorrenciaDto> ObterAsync(Ator ator, Guid id, CancellationToken ct)
    {
        var o = await CarregarAsync(id, ct);
        var comMomento = await AutorizarLeituraAsync(ator, o, ct);
        var alertas = await AlertasDasAsync([o.Id], ct);
        return OcorrenciaMapa.ParaDto(o, comMomento, alertas.GetValueOrDefault(o.Id, []), await ContasDaVitimaAsync(o.UsuarioId, ct));
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
        var alertas = await AlertasDasAsync(recentes, ct);
        var cacheContas = new Dictionary<Guid, IReadOnlyList<ContaOcorrenciaDto>>();
        var saida = new List<OcorrenciaDto>(lista.Count);
        foreach (var o in lista.OrderByDescending(x => x.IniciadaEm))
        {
            if (!cacheContas.TryGetValue(o.UsuarioId, out var cs)) cacheContas[o.UsuarioId] = cs = await ContasDaVitimaAsync(o.UsuarioId, ct);
            saida.Add(OcorrenciaMapa.ParaDto(o, o.UsuarioId == ator.UsuarioId, alertas.GetValueOrDefault(o.Id, []), cs));
        }
        return saida;
    }

    public async Task MarcarMomentoAsync(Ator ator, Guid id, DateTime em, double lat, double lng, CancellationToken ct)
    {
        var o = await CarregarAsync(id, ct, rastrear: true);
        await ExigirDonoAsync(ator, o, ct);
        o.MarcarMomento(em, lat, lng, Agora);
        await db.SaveChangesAsync(ct);
    }

    public async Task CancelarAsync(Ator ator, Guid id, CancellationToken ct)
    {
        var o = await CarregarAsync(id, ct, rastrear: true);
        await ExigirDonoAsync(ator, o, ct);
        // Política: valida o cancelamento, publica o resolve e só então grava. Se o gateway falhar, a exceção sobe
        // e a ocorrência continua Aberta, então o cliente pode repetir e o chaveiro ainda recebe o resolve.
        o.Cancelar(Agora);
        if (o is { ChaveiroDeviceId: { } device, ChaveiroAlertId: { } alerta })
            await gateway.PublicarComandoAsync(device, ComandoChaveiro.Resolve(alerta), ct);
        await db.SaveChangesAsync(ct);
        await escalonamento.EncerrarAlertasAsync(o.Id, "cancelado", ct);
    }

    public async Task ConcluirPassoAsync(Ator ator, Guid ocorrenciaId, PassoBloqueio passo, CancellationToken ct)
    {
        var o = await CarregarAsync(ocorrenciaId, ct, rastrear: true);
        // Só o guardião da vítima conclui passos; dono e emergência levam 403 com registro.
        if (ator.Escopo != Escopos.Usuario || ator.UsuarioId == o.UsuarioId || !await guardioes.EhGuardiaoDeAsync(ator.UsuarioId, o.UsuarioId, ct))
            NegarAcesso(o);

        // Repetir um passo já concluído é inócuo (204), mesmo com a ocorrência já encerrada.
        if (o.Passos.Single(p => p.Passo == passo).ConcluidoEm.HasValue) return;
        if (o.Estado != EstadoOcorrencia.Aberta) throw new ConflitoException("ocorrencia-nao-aberta");

        var agora = Agora;
        var completo = o.ConcluirPasso(passo, agora);
        if (completo)
        {
            // Mesma política do cancelar: resolve antes de gravar, para o cliente poder repetir se o gateway falhar.
            o.Encerrar(agora);
            if (o is { ChaveiroDeviceId: { } device, ChaveiroAlertId: { } alerta })
                await gateway.PublicarComandoAsync(device, ComandoChaveiro.Resolve(alerta), ct);
        }
        await db.SaveChangesAsync(ct);

        var destinatarios = await db.Guardioes.AsNoTracking().Where(g => g.UsuarioId == o.UsuarioId).Select(g => g.GuardiaoUsuarioId).ToListAsync(ct);
        await notificador.PassoAtualizadoAsync(destinatarios, new PassoAtualizadoMsg(o.Id, passo.ToString(), agora), ct);
        if (completo) await escalonamento.EncerrarAlertasAsync(o.Id, "encerrado", ct);
    }

    public async Task CancelarPorChaveiroAsync(string deviceId, string alertId, CancellationToken ct)
    {
        var o = await db.Ocorrencias.Include(x => x.Passos)
            .FirstOrDefaultAsync(x => x.ChaveiroDeviceId == deviceId && x.ChaveiroAlertId == alertId && x.Estado == EstadoOcorrencia.Aberta, ct);
        if (o is null) return;
        o.Cancelar(Agora);
        await db.SaveChangesAsync(ct);
        await escalonamento.EncerrarAlertasAsync(o.Id, "cancelado", ct);
    }

    private async Task<IReadOnlyDictionary<Guid, IReadOnlyList<AlertaDto>>> AlertasDasAsync(IReadOnlyCollection<Guid> ocorrenciaIds, CancellationToken ct)
    {
        var linhas = await db.Alertas.AsNoTracking().Where(a => ocorrenciaIds.Contains(a.OcorrenciaId)).ToListAsync(ct);
        return linhas.GroupBy(a => a.OcorrenciaId).ToDictionary(
            g => g.Key,
            g => (IReadOnlyList<AlertaDto>)g.OrderBy(a => a.DisparadoEm).Select(a => new AlertaDto(a.Id, a.GuardiaoId, a.DisparadoEm, a.CienteEm)).ToList());
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

    private async Task ExigirDonoAsync(Ator ator, Ocorrencia o, CancellationToken ct)
    {
        if (ator.UsuarioId == o.UsuarioId) return;
        // Guardião legítimo sem permissão para a ação leva 403 sem virar sinal de acesso indevido.
        if (ator.Escopo == Escopos.Usuario && await guardioes.EhGuardiaoDeAsync(ator.UsuarioId, o.UsuarioId, ct))
            throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
        NegarAcesso(o);
    }

    private void NegarAcesso(Ocorrencia o)
    {
        acessoIndevido.Registrar(o.UsuarioId, "recurso-de-outro-usuario");
        throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
    }

    /// <summary>Dono (qualquer escopo) lê tudo; guardião (escopo usuario) lê sem o momento. Devolve se o momento pode ir junto.</summary>
    private async Task<bool> AutorizarLeituraAsync(Ator ator, Ocorrencia o, CancellationToken ct)
    {
        if (ator.UsuarioId == o.UsuarioId) return true;
        if (ator.Escopo == Escopos.Usuario && await guardioes.EhGuardiaoDeAsync(ator.UsuarioId, o.UsuarioId, ct)) return false;
        NegarAcesso(o);
        return false;
    }

    private async Task<IReadOnlyList<ContaOcorrenciaDto>> ContasDaVitimaAsync(Guid vitimaId, CancellationToken ct) =>
        (await contas.ListarVinculadasAsync(vitimaId, ct)).Select(c => new ContaOcorrenciaDto(c.Nome, c.Tipo, c.Telefone, c.Link)).ToList();
}
