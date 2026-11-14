using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>O que o tradutor enxerga de um evento: so categoria, sink e tipo. Nunca o valor do dado nem o titular.</summary>
public sealed record EventoTecnico(string Categoria, string Sink, string Tipo)
{
    public const string AcessoIndevido = "AcessoIndevido";

    public static EventoTecnico De(EventoSeguranca e) =>
        IndiceRisco.EhAcessoIndevido(e)
            ? new(AcessoIndevido, e.Sink.ToString(), AcessoIndevido)
            : new(e.Classe.ToString(), e.Sink.ToString(), e.Decisao.ToString());
}

/// <summary>Traduz uma falha tecnica para um aviso de 2 frases a um cidadao leigo. Nunca lanca: na falha devolve a frase padrao.</summary>
public interface ITradutorRisco
{
    Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default);
}
