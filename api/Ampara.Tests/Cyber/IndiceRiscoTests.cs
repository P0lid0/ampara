using Ampara.Domain.Cyber;

namespace Ampara.Tests.Cyber;

public class IndiceRiscoTests
{
    private static readonly Guid U = Guid.Parse("00000000-0000-0000-0000-0000000000a1");
    private static readonly DateTimeOffset Agora = new(2026, 11, 14, 12, 0, 0, TimeSpan.Zero);

    private static EventoSeguranca Ev(Sink sink, Decisao d, string campo = "x", PiiClasse classe = PiiClasse.Cpf,
        Guid? alvo = null, DateTimeOffset? em = null, bool semAlvo = false) =>
        EventoSeguranca.Novo(em ?? Agora.AddHours(-1), "cid", OrigemDado.Http, campo, classe, sink, d,
            semAlvo ? null : alvo ?? U);

    private static int Peso(EventoSeguranca e) => IndiceRisco.Peso(e);

    [Theory]
    [InlineData(0, Farol.Verde)] [InlineData(29, Farol.Verde)] [InlineData(30, Farol.Amarelo)]
    [InlineData(69, Farol.Amarelo)] [InlineData(70, Farol.Vermelho)] [InlineData(100, Farol.Vermelho)]
    public void FarolDe_respeita_limites(int i, Farol f) => Assert.Equal(f, IndiceRisco.FarolDe(i));

    [Fact]
    public void Pesos_do_contrato()
    {
        Assert.Equal(10, Peso(Ev(Sink.Log, Decisao.Bloqueado)));
        Assert.Equal(25, Peso(Ev(Sink.HttpNaoAutenticada, Decisao.Bloqueado)));
        Assert.Equal(40, Peso(Ev(Sink.HttpNaoAutenticada, Decisao.Bloqueado, IndiceRisco.CampoCodigoEmergencia)));
        Assert.Equal(40, Peso(Ev(Sink.Banco, Decisao.Bloqueado, IndiceRisco.CampoRecursoOutroUsuario)));
        foreach (var s in new[] { Sink.Erro, Sink.Ponte, Sink.SignalR, Sink.Llm, Sink.Banco })
            Assert.Equal(10, Peso(Ev(s, Decisao.Bloqueado)));
        foreach (var d in new[] { Decisao.Mascarado, Decisao.Cifrado, Decisao.Permitido })
            Assert.Equal(0, Peso(Ev(Sink.Log, d)));
        Assert.Equal(0, Peso(Ev(Sink.HttpAutenticada, Decisao.Permitido, "bo.imei")));
    }

    [Fact]
    public void Acesso_indevido_so_vale_quando_bloqueado()
    {
        Assert.True(IndiceRisco.EhAcessoIndevido(Ev(Sink.Banco, Decisao.Bloqueado, IndiceRisco.CampoRecursoOutroUsuario)));
        Assert.False(IndiceRisco.EhAcessoIndevido(Ev(Sink.Banco, Decisao.Permitido, IndiceRisco.CampoRecursoOutroUsuario)));
        Assert.False(IndiceRisco.EhAcessoIndevido(Ev(Sink.Log, Decisao.Bloqueado)));
    }

    [Fact]
    public void Calcular_soma_24h_do_dono_com_teto()
    {
        var outro = Guid.NewGuid();
        var tres = Enumerable.Range(0, 3).Select(_ => Ev(Sink.Log, Decisao.Bloqueado)).ToList();
        Assert.Equal(30, IndiceRisco.Calcular(tres, U, Agora));

        var ruido = new List<EventoSeguranca>(tres)
        {
            Ev(Sink.Log, Decisao.Bloqueado, alvo: outro),
            Ev(Sink.Log, Decisao.Bloqueado, semAlvo: true),
            Ev(Sink.Log, Decisao.Bloqueado, em: Agora.AddHours(-24).AddMinutes(-1)),
        };
        Assert.Equal(30, IndiceRisco.Calcular(ruido, U, Agora));

        ruido.Add(Ev(Sink.Log, Decisao.Bloqueado, em: Agora.AddHours(-24).AddMinutes(1)));   // há 23h59 conta
        Assert.Equal(40, IndiceRisco.Calcular(ruido, U, Agora));

        var tresIndevidos = Enumerable.Range(0, 3)
            .Select(_ => Ev(Sink.Banco, Decisao.Bloqueado, IndiceRisco.CampoRecursoOutroUsuario));
        Assert.Equal(100, IndiceRisco.Calcular(tresIndevidos, U, Agora));
        Assert.Equal(0, IndiceRisco.Calcular([], U, Agora));
    }

    [Fact]
    public void Calcular_exclui_eventos_do_futuro_e_exatamente_24h()
    {
        var limite = Ev(Sink.Log, Decisao.Bloqueado, em: Agora.AddHours(-24));
        var futuro = Ev(Sink.Log, Decisao.Bloqueado, em: Agora.AddSeconds(1));
        var agoraExato = Ev(Sink.Log, Decisao.Bloqueado, em: Agora);
        Assert.Equal(10, IndiceRisco.Calcular([limite, futuro, agoraExato], U, Agora));
    }
}
