using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Índice, farol e agregados das últimas 24 h. O agregado executivo é calculado em memória sobre o repositório.</summary>
public sealed class IndiceRiscoService(IEventoSegurancaRepository repo, ITradutorRisco tradutor, TimeProvider tempo) : IIndiceRiscoService
{
    public const int MaxEventos = 50;

    public async Task<MeuRiscoDto> MeuRiscoAsync(Guid usuarioId, CancellationToken ct = default)
    {
        var agora = tempo.GetUtcNow();
        var eventos = await repo.DesdeAsync(agora.AddHours(-24), usuarioId, ct);
        var indice = IndiceRisco.Calcular(eventos, usuarioId, agora);

        var recentes = eventos.Where(e => e.UsuarioAlvoId == usuarioId).OrderByDescending(e => e.Em).Take(MaxEventos).ToList();
        var dtos = new List<EventoSegurancaDto>(recentes.Count);
        foreach (var e in recentes)
        {
            var msg = e.MensagemCidadao;
            if (string.IsNullOrWhiteSpace(msg))
                msg = await tradutor.TraduzirAsync(EventoTecnico.De(e), ct);   // nunca lança: na falha devolve a frase padrão
            dtos.Add(new(e.Id, e.Em, e.CorrelationId, e.Source, e.Campo, e.Classe, e.Sink, e.Decisao, msg));
        }
        return new(indice, IndiceRisco.FarolDe(indice), dtos);
    }

    public async Task<ExecutivoDto> ExecutivoAsync(CancellationToken ct = default)
    {
        var agora = tempo.GetUtcNow();
        var desde = agora.AddHours(-24);
        var eventos = (await repo.DesdeAsync(desde, null, ct)).Where(e => e.Decisao != Decisao.Permitido).ToList();

        var porClasse = Enum.GetValues<PiiClasse>().ToDictionary(c => c.ToString(), _ => 0);
        var porSink = Enum.GetValues<Sink>().ToDictionary(s => s.ToString(), _ => 0);
        var porHora = new int[24];
        foreach (var e in eventos)
        {
            porClasse[e.Classe.ToString()]++;
            porSink[e.Sink.ToString()]++;
            var pos = 23 - (int)Math.Floor((agora - e.Em).TotalHours);
            porHora[Math.Clamp(pos, 0, 23)]++;
        }
        return new(porClasse, porSink, porHora, eventos.Count);
    }
}
