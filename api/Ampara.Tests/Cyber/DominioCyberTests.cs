using System.Text.Json;
using Ampara.Domain.Cyber;

namespace Ampara.Tests.Cyber;

public class DominioCyberTests
{
    [Fact]
    public void Enums_do_plano_02_continuam_no_formato_do_contrato()
    {
        Assert.Equal("\"mqtt\"", JsonSerializer.Serialize(OrigemDado.Mqtt));
        Assert.Equal("\"verde\"", JsonSerializer.Serialize(Farol.Verde));
        Assert.Equal("\"HttpNaoAutenticada\"", JsonSerializer.Serialize(Sink.HttpNaoAutenticada));
        Assert.Equal("\"HttpAutenticada\"", JsonSerializer.Serialize(Sink.HttpAutenticada));
    }

    [Fact]
    public void Sensitive_nunca_mostra_o_valor()
    {
        var s = new Sensitive<string>("529.982.247-25", PiiClasse.Cpf, "documento");   // SINTETICO
        Assert.Equal("[PII:Cpf]", s.ToString());
        Assert.Equal("[PII:Cpf]", $"{s}");
        Assert.Equal("\"[PII:Cpf]\"", JsonSerializer.Serialize(s));
    }

    [Fact]
    public void Sensitive_dentro_de_objeto_tambem_sai_mascarado()
    {
        var o = new { Doc = new Sensitive<string>("529.982.247-25", PiiClasse.Cpf, "documento") };   // SINTETICO
        var json = JsonSerializer.Serialize(o);
        Assert.Equal("{\"Doc\":\"[PII:Cpf]\"}", json);
        Assert.DoesNotContain("529", json);
    }

    [Fact]
    public void Atributos_guardam_a_classe()
    {
        Assert.Equal(PiiClasse.Imei, new PiiCifradoAttribute(PiiClasse.Imei).Classe);
        Assert.Equal(new[] { PiiClasse.Imei, PiiClasse.Placa },
            new PiiPermitidaAttribute(PiiClasse.Imei, PiiClasse.Placa).Classes);
        Assert.NotNull(new TextoLivreAttribute());
    }
}
