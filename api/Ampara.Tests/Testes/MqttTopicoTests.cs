using Ampara.Infrastructure.Mqtt;

namespace Ampara.Tests;

public class MqttTopicoTests
{
    [Theory]
    [InlineData("citizentech/chaveiro/chaveiro-ampara-a1b2c3/events", true, "chaveiro-ampara-a1b2c3", "events")]
    [InlineData("citizentech/chaveiro/chaveiro-ampara-a1b2c3/status", true, "chaveiro-ampara-a1b2c3", "status")]
    [InlineData("citizentech/chaveiro/x/cmd", false, "", "")]
    [InlineData("outro/chaveiro/x/events", false, "", "")]
    [InlineData("citizentech/chaveiro//events", false, "", "")]
    [InlineData("citizentech/chaveiro/+/events", false, "", "")]
    [InlineData("citizentech/chaveiro/x/events/extra", false, "", "")]
    public void Le_topico(string t, bool ok, string dev, string tipo)
    {
        Assert.Equal(ok, TopicoChaveiro.TentarLer(t, out var d, out var ty));
        if (ok) { Assert.Equal(dev, d); Assert.Equal(tipo, ty); }
    }

    [Fact]
    public void Cmd_monta_o_topico() =>
        Assert.Equal("citizentech/chaveiro/chaveiro-ampara-a1b2c3/cmd", TopicoChaveiro.Cmd("chaveiro-ampara-a1b2c3"));

    [Fact]
    public void Raizes_de_assinatura()
    {
        Assert.Equal("citizentech/chaveiro/+/events", TopicoChaveiro.RaizEventos);
        Assert.Equal("citizentech/chaveiro/+/status", TopicoChaveiro.RaizStatus);
    }
}
