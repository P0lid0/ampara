using Ampara.Application.Comum;
using Ampara.Domain;
using Ampara.Domain.Entidades;
using Ampara.Domain.Gatilhos;

namespace Ampara.Tests;

public class OcorrenciaDominioTests
{
    private static readonly DateTime Agora = new(2026, 11, 14, 12, 0, 0, DateTimeKind.Utc);

    private static Ocorrencia Nova() => Ocorrencia.Iniciar(Guid.NewGuid(), OrigemGatilho.Web, Agora);

    [Fact]
    public void Iniciar_cria_cinco_passos_pendentes()
    {
        var o = Ocorrencia.Iniciar(Guid.NewGuid(), OrigemGatilho.Web, DateTime.UtcNow);
        Assert.Equal(EstadoOcorrencia.Aberta, o.Estado);
        Assert.Equal(5, o.Passos.Count);
        Assert.All(o.Passos, p => Assert.Null(p.ConcluidoEm));
        Assert.Equal(Enum.GetValues<PassoBloqueio>().OrderBy(x => x), o.Passos.Select(p => p.Passo).OrderBy(x => x));
    }

    [Fact]
    public void Cancelar_duas_vezes_conflita()
    {
        var o = Nova();
        o.Cancelar(Agora);
        Assert.Equal(EstadoOcorrencia.Cancelada, o.Estado);
        Assert.Equal(Agora, o.EncerradaEm);
        var e = Assert.Throws<ConflitoException>(() => o.Cancelar(Agora));
        Assert.Equal("ocorrencia-nao-aberta", e.Codigo);
        Assert.Throws<ConflitoException>(() => o.Encerrar(Agora));
    }

    [Fact]
    public void Momento_apos_cancelada_ou_no_futuro_ou_coordenada_invalida_falha()
    {
        var o = Nova();
        o.MarcarMomento(Agora.AddMinutes(-10), -23.56, -46.69, Agora);
        Assert.Equal(-23.56, o.MomentoLat);
        Assert.Throws<DominioException>(() => o.MarcarMomento(Agora.AddMinutes(6), -23.5, -46.6, Agora));
        Assert.Throws<DominioException>(() => o.MarcarMomento(Agora.AddDays(-8), -23.5, -46.6, Agora));
        Assert.Throws<DominioException>(() => o.MarcarMomento(Agora, 91, -46.6, Agora));
        Assert.Throws<DominioException>(() => o.MarcarMomento(Agora, -23.5, 181, Agora));
        Assert.Throws<DominioException>(() => o.MarcarMomento(Agora, double.NaN, -46.6, Agora));
        o.Cancelar(Agora);
        Assert.Throws<DominioException>(() => o.MarcarMomento(Agora, -23.5, -46.6, Agora));
    }

    [Fact]
    public void ConcluirPasso_e_idempotente_e_sinaliza_o_quinto()
    {
        var o = Nova();
        var t1 = Agora.AddMinutes(1);
        Assert.False(o.ConcluirPasso(PassoBloqueio.Banco, t1));
        Assert.False(o.ConcluirPasso(PassoBloqueio.Banco, t1.AddMinutes(5)));
        Assert.Equal(t1, o.Passos.Single(p => p.Passo == PassoBloqueio.Banco).ConcluidoEm);
        Assert.False(o.ConcluirPasso(PassoBloqueio.CelularSeguro, t1));
        Assert.False(o.ConcluirPasso(PassoBloqueio.Operadora, t1));
        Assert.False(o.ConcluirPasso(PassoBloqueio.Senhas, t1));
        Assert.True(o.ConcluirPasso(PassoBloqueio.Bo, t1));
        Assert.True(o.ConcluirPasso(PassoBloqueio.Bo, t1));
    }

    [Fact]
    public void GatilhoChaveiro_limita_inicio_ao_agora()
    {
        var vitima = Guid.NewGuid();
        var o = new GatilhoChaveiro("chaveiro-ampara-a1b2c3", "chaveiro-ampara-a1b2c3-17", Agora.AddHours(2)).CriarOcorrencia(vitima, Agora);
        Assert.Equal(Agora, o.IniciadaEm);
        Assert.Equal(OrigemGatilho.Chaveiro, o.Origem);
        Assert.Equal("chaveiro-ampara-a1b2c3", o.ChaveiroDeviceId);
        Assert.Equal("chaveiro-ampara-a1b2c3-17", o.ChaveiroAlertId);
        var passado = new GatilhoChaveiro("d", "a", Agora.AddMinutes(-3)).CriarOcorrencia(vitima, Agora);
        Assert.Equal(Agora.AddMinutes(-3), passado.IniciadaEm);
        Assert.Equal(OrigemGatilho.Web, new GatilhoWeb().CriarOcorrencia(vitima, Agora).Origem);
        Assert.Equal(OrigemGatilho.Guardiao, new GatilhoGuardiao(Guid.NewGuid()).CriarOcorrencia(vitima, Agora).Origem);
    }

    [Fact]
    public void Reaproveitar_vincula_o_chaveiro_sem_tomar_o_de_outro_aparelho()
    {
        var o = Nova();
        new GatilhoChaveiro("chaveiro-a", "a-1", Agora).Reaproveitar(o);
        Assert.Equal(("chaveiro-a", "a-1"), (o.ChaveiroDeviceId, o.ChaveiroAlertId));
        new GatilhoImpacto("chaveiro-a", "a-2", Agora).Reaproveitar(o);   // alerta mais novo do mesmo aparelho
        Assert.Equal("a-2", o.ChaveiroAlertId);
        new GatilhoChaveiro("chaveiro-b", "b-1", Agora).Reaproveitar(o);  // outro aparelho não toma o vínculo
        Assert.Equal(("chaveiro-a", "a-2"), (o.ChaveiroDeviceId, o.ChaveiroAlertId));
        ((IGatilho)new GatilhoWeb()).Reaproveitar(o);
        Assert.Equal("chaveiro-a", o.ChaveiroDeviceId);
        o.Cancelar(Agora);
        new GatilhoChaveiro("chaveiro-a", "a-3", Agora).Reaproveitar(o);  // fechada não muda
        Assert.Equal("a-2", o.ChaveiroAlertId);
    }
}
