using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Application.Ocorrencias;
using Ampara.Domain;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Alertas;

public sealed class Escalonamento(
    IAmparaDb db, IGuardiaoNotificador notificador, IAcessoIndevido acessoIndevido,
    OpcoesEscalonamento opcoes, TimeProvider tempo) : IEscalonamento
{
    private DateTime Agora => tempo.GetUtcNow().UtcDateTime;

    public async Task IniciarAsync(Guid ocorrenciaId, CancellationToken ct)
    {
        var o = await db.Ocorrencias.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ocorrenciaId, ct);
        if (o is null || o.Estado != EstadoOcorrencia.Aberta) return;
        var primeiro = (await db.Guardioes.AsNoTracking().Where(g => g.UsuarioId == o.UsuarioId).ToListAsync(ct))
            .OrderBy(g => g.Ordem).FirstOrDefault();
        if (primeiro is null) return;

        var alerta = Alerta.Disparar(ocorrenciaId, primeiro, Agora);
        db.Alertas.Add(alerta);
        await db.SaveChangesAsync(ct);
        await notificador.AlertaDisparadoAsync(alerta.GuardiaoUsuarioId, await MensagemAsync(alerta, o, ct), ct);
    }

    public async Task<int> ProcessarVencidosAsync(CancellationToken ct)
    {
        var abertas = await db.Ocorrencias.AsNoTracking().Where(o => o.Estado == EstadoOcorrencia.Aberta).Select(o => o.Id).ToListAsync(ct);
        var escaladas = 0;
        foreach (var id in abertas)
            if (await TentarEscalarAsync(id, ct)) escaladas++;
        return escaladas;
    }

    private async Task<bool> TentarEscalarAsync(Guid ocorrenciaId, CancellationToken ct)
    {
        var resultado = await db.TransacaoAsync(async () =>
        {
            // Trava por ocorrência e relê tudo dentro dela: duas instâncias não escalam a mesma ocorrência juntas.
            await db.TravarPorChaveAsync("escalada:" + ocorrenciaId, ct);
            var o = await db.Ocorrencias.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ocorrenciaId, ct);
            if (o is null || o.Estado != EstadoOcorrencia.Aberta) return null;
            var alertas = await db.Alertas.Where(a => a.OcorrenciaId == ocorrenciaId).ToListAsync(ct);
            if (alertas.Count == 0 || alertas.Any(a => a.Estado == EstadoAlerta.Ciente)) return null;

            var agora = Agora;
            // Datas comparadas em memória: o SQLite dos testes não compara data UTC de forma confiável no servidor.
            var recente = alertas.MaxBy(a => a.DisparadoEm)!;
            if (recente.DisparadoEm + opcoes.TempoCiente > agora) return null;

            var acionados = alertas.Select(a => a.GuardiaoId).ToList();
            var proximo = (await db.Guardioes.AsNoTracking().Where(g => g.UsuarioId == o.UsuarioId).ToListAsync(ct))
                .OrderBy(g => g.Ordem).FirstOrDefault(g => g.PodeEscalar(acionados));
            if (proximo is null) return null;   // esgotados os guardiões

            recente.MarcarEscalado(agora);
            var novo = Alerta.Disparar(ocorrenciaId, proximo, agora);
            db.Alertas.Add(novo);
            await db.SaveChangesAsync(ct);
            return new Escalada(o, novo, alertas.Select(a => a.GuardiaoUsuarioId).Distinct().ToList());
        }, ct);

        if (resultado is null) return false;
        await notificador.AlertaDisparadoAsync(resultado.Novo.GuardiaoUsuarioId, await MensagemAsync(resultado.Novo, resultado.Ocorrencia, ct), ct);
        await notificador.AlertaEscaladoAsync(resultado.Anteriores,
            new AlertaEscaladoMsg(resultado.Novo.Id, ocorrenciaId, resultado.Novo.GuardiaoId, resultado.Novo.DisparadoEm), ct);
        return true;
    }

    private sealed record Escalada(Ocorrencia Ocorrencia, Alerta Novo, IReadOnlyList<Guid> Anteriores);

    public async Task ConfirmarCienteAsync(Ator ator, Guid alertaId, CancellationToken ct)
    {
        var alerta = await db.Alertas.FirstOrDefaultAsync(a => a.Id == alertaId, ct)
            ?? throw new NaoEncontradoException("alerta-nao-encontrado");
        if (ator.Escopo != Escopos.Usuario || alerta.GuardiaoUsuarioId != ator.UsuarioId)
        {
            var vitimaId = await db.Ocorrencias.AsNoTracking().Where(o => o.Id == alerta.OcorrenciaId).Select(o => o.UsuarioId).FirstAsync(ct);
            // Guardião legítimo da vítima, mas de outro alerta, leva 403 sem virar sinal de acesso indevido.
            var legitimo = ator.Escopo == Escopos.Usuario
                && await db.Guardioes.AsNoTracking().AnyAsync(g => g.UsuarioId == vitimaId && g.GuardiaoUsuarioId == ator.UsuarioId, ct);
            if (!legitimo) acessoIndevido.Registrar(vitimaId, "recurso-de-outro-usuario");
            throw new AcessoNegadoException("alerta-de-outro-guardiao");
        }

        var o = await db.Ocorrencias.AsNoTracking().FirstAsync(x => x.Id == alerta.OcorrenciaId, ct);
        // Alerta já encerrado (ciente de outro, cancelamento ou fim) e repetição: nada a fazer.
        if (alerta.Estado != EstadoAlerta.Ativo || o.Estado != EstadoOcorrencia.Aberta) return;

        alerta.Confirmar(Agora);
        var outros = await db.Alertas.Where(a => a.OcorrenciaId == alerta.OcorrenciaId && a.Id != alerta.Id && a.Estado == EstadoAlerta.Ativo).ToListAsync(ct);
        foreach (var x in outros) x.Encerrar();
        await db.SaveChangesAsync(ct);
        foreach (var x in outros)
            await notificador.AlertaEncerradoAsync(x.GuardiaoUsuarioId, new AlertaEncerradoMsg(x.Id, "ciente"), ct);
    }

    public async Task EncerrarAlertasAsync(Guid ocorrenciaId, string motivo, CancellationToken ct)
    {
        var alertas = await db.Alertas.Where(a => a.OcorrenciaId == ocorrenciaId && a.Estado != EstadoAlerta.Encerrado).ToListAsync(ct);
        if (alertas.Count == 0) return;
        foreach (var a in alertas) a.Encerrar();
        await db.SaveChangesAsync(ct);
        foreach (var a in alertas)
            await notificador.AlertaEncerradoAsync(a.GuardiaoUsuarioId, new AlertaEncerradoMsg(a.Id, motivo), ct);
    }

    public async Task<IReadOnlyList<AlertaAtivoDto>> AtivosAsync(Guid guardiaoUsuarioId, CancellationToken ct)
    {
        var linhas = await (from a in db.Alertas.AsNoTracking()
                            join o in db.Ocorrencias.AsNoTracking() on a.OcorrenciaId equals o.Id
                            join u in db.Usuarios.AsNoTracking() on o.UsuarioId equals u.Id
                            where a.GuardiaoUsuarioId == guardiaoUsuarioId && a.Estado == EstadoAlerta.Ativo && o.Estado == EstadoOcorrencia.Aberta
                            select new { a.Id, a.OcorrenciaId, u.Nome, o.Origem, a.DisparadoEm }).ToListAsync(ct);
        return linhas.OrderByDescending(x => x.DisparadoEm)
            .Select(x => new AlertaAtivoDto(x.Id, x.OcorrenciaId, x.Nome, OcorrenciaMapa.OrigemTexto(x.Origem), x.DisparadoEm)).ToList();
    }

    private async Task<AlertaDisparadoMsg> MensagemAsync(Alerta a, Ocorrencia o, CancellationToken ct)
    {
        var nome = await db.Usuarios.AsNoTracking().Where(u => u.Id == o.UsuarioId).Select(u => u.Nome).FirstAsync(ct);
        return new AlertaDisparadoMsg(a.Id, o.Id, nome, OcorrenciaMapa.OrigemTexto(o.Origem), a.DisparadoEm);
    }
}
