namespace Ampara.Domain.Cyber;

/// <summary>Índice de risco do cidadão (0 a 100) a partir dos eventos de segurança das últimas 24 h.</summary>
public static class IndiceRisco
{
    public const string CampoCodigoEmergencia = "codigo-emergencia";
    public const string CampoRecursoOutroUsuario = "recurso-de-outro-usuario";

    public static bool EhAcessoIndevido(EventoSeguranca e) =>
        e.Decisao == Decisao.Bloqueado && e.Campo is CampoCodigoEmergencia or CampoRecursoOutroUsuario;

    public static int Peso(EventoSeguranca e)
    {
        if (e.Decisao != Decisao.Bloqueado) return 0;
        if (EhAcessoIndevido(e)) return 40;
        return e.Sink == Sink.HttpNaoAutenticada ? 25 : 10;
    }

    public static int Calcular(IEnumerable<EventoSeguranca> eventos, Guid usuarioId, DateTimeOffset agora)
    {
        var desde = agora.AddHours(-24);
        var soma = eventos
            .Where(e => e.UsuarioAlvoId == usuarioId && e.Em > desde && e.Em <= agora)
            .Sum(Peso);
        return Math.Min(100, soma);
    }

    public static Farol FarolDe(int indice) => indice >= 70 ? Farol.Vermelho : indice >= 30 ? Farol.Amarelo : Farol.Verde;
}
