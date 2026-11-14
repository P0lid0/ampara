using Ampara.Application.Comum;
using Ampara.Application.Ocorrencias;
using Ampara.Domain.Entidades;
using Ampara.Domain.Gatilhos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ampara.Application.Chaveiros;

public sealed class ChaveiroEventoService(IAmparaDb db, IOcorrenciaService ocorrencias, IChaveiroGateway gateway, ILogger<ChaveiroEventoService> log) : IChaveiroEventoService
{
    public async Task TratarEventoAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct)
    {
        var m = MensagemChaveiro.Ler(payload);
        if (m is null || m.DeviceId != deviceIdDoTopico)
        {
            log.LogWarning("Evento de chaveiro descartado (payload inválido ou deviceId diferente do tópico) em {Topico}", deviceIdDoTopico);
            return;
        }
        chegadaUtc = DateTime.SpecifyKind(chegadaUtc, DateTimeKind.Utc);

        if (m.Tipo == "low_battery")
        {
            // Sem ack: o contrato não o espera.
            var c = await db.Chaveiros.FirstOrDefaultAsync(x => x.DeviceId == m.DeviceId, ct);
            if (c is null) return;
            c.RegistrarSinal(m.Battery, chegadaUtc);
            await db.SaveChangesAsync(ct);
            return;
        }

        var pareado = await db.Chaveiros.AsNoTracking().AnyAsync(x => x.DeviceId == m.DeviceId, ct);
        if (!pareado || await JaRegistradoAsync(m.EventId, ct))
        {
            await AckAsync(m, ct);
            return;
        }

        try
        {
            await db.TransacaoAsync(async () =>
            {
                var c = await db.Chaveiros.FirstAsync(x => x.DeviceId == m.DeviceId, ct);
                var registro = new EventoRecebido
                {
                    Id = Guid.NewGuid(), EventId = m.EventId, DeviceId = m.DeviceId, Tipo = m.Tipo, RecebidoEm = chegadaUtc,
                };
                db.EventosRecebidos.Add(registro);
                await db.SaveChangesAsync(ct);   // o índice único barra o repetido concorrente aqui
                c.RegistrarSinal(m.Battery, chegadaUtc);

                switch (m.Tipo)
                {
                    case "alert":
                        var emClique = m.Ts is { } ts ? DateTimeOffset.FromUnixTimeSeconds(ts).UtcDateTime : chegadaUtc.AddMilliseconds(-m.AgeMs);
                        var r = await ocorrencias.DispararAsync(new GatilhoChaveiro(m.DeviceId, m.AlertId ?? m.EventId, emClique), c.UsuarioId, ct);
                        registro.OcorrenciaId = r.OcorrenciaId;
                        break;
                    case "cancel":
                        if (!string.IsNullOrEmpty(m.AlertId)) await ocorrencias.CancelarPorChaveiroAsync(m.DeviceId, m.AlertId, ct);
                        break;
                }
                await db.SaveChangesAsync(ct);
                return true;
            }, ct);
        }
        catch (DbUpdateException)
        {
            // Só é corrida (outro processamento do mesmo eventId venceu pelo índice único) se o evento já está gravado;
            // qualquer outra falha sobe com a exceção original.
            if (!await JaRegistradoDepoisDeFalhaAsync(m.EventId, ct)) throw;
        }
        await AckAsync(m, ct);
    }

    public async Task TratarStatusAsync(string deviceIdDoTopico, string payload, DateTime chegadaUtc, CancellationToken ct)
    {
        var s = StatusChaveiro.Ler(payload);
        if (s is null || s.DeviceId != deviceIdDoTopico)
        {
            log.LogWarning("Status de chaveiro descartado em {Topico}", deviceIdDoTopico);
            return;
        }
        var c = await db.Chaveiros.FirstOrDefaultAsync(x => x.DeviceId == s.DeviceId, ct);
        if (c is null) return;
        c.AtualizarStatus(s.Online, s.Battery, chegadaUtc);
        await db.SaveChangesAsync(ct);
    }

    private Task<bool> JaRegistradoAsync(string eventId, CancellationToken ct) =>
        db.EventosRecebidos.AsNoTracking().AnyAsync(e => e.EventId == eventId, ct);

    private async Task<bool> JaRegistradoDepoisDeFalhaAsync(string eventId, CancellationToken ct)
    {
        // A transação falhou: descarta o estado rastreado antes de reconsultar.
        db.LimparRastreamento();
        return await JaRegistradoAsync(eventId, ct);
    }

    /// <summary>Publica o ack depois da ação. Falha só vai para o log: o chaveiro reenvia em 5 s.</summary>
    private async Task AckAsync(MensagemChaveiro m, CancellationToken ct)
    {
        try { await gateway.PublicarComandoAsync(m.DeviceId, ComandoChaveiro.Ack(m.EventId), ct); }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Falha ao publicar ack do evento {EventId}; o chaveiro reenvia", m.EventId);
        }
    }
}
