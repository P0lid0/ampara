using System.Security.Cryptography;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure;
using Ampara.Infrastructure.Cripto;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests.Cyber;

public class PiiProtetorTests
{
    private static readonly string ChaveDeTesteBase64 = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO

    private static IConfiguration Config(string? chave)
    {
        var d = new Dictionary<string, string?>();
        if (chave is not null) d["AMPARA_CRYPTO_KEY"] = chave;
        return new ConfigurationBuilder().AddInMemoryCollection(d).Build();
    }
    private static PiiProtetor Novo() => new(Config(ChaveDeTesteBase64));
    private static IConfiguration ConfigSemChave() => Config(null);

    [Fact] public void Mascaras_da_spec() {   // SINTETICO
        var p = Novo();
        Assert.Equal("***.456.***-00", p.Mascarar(PiiClasse.Cpf, "123.456.789-00"));      // exemplo do professor
        Assert.Equal("***.456.***-09", p.Mascarar(PiiClasse.Cpf, "12345678909"));
        Assert.Equal("m***@exemplo.com.br", p.Mascarar(PiiClasse.Email, "maria.teste@exemplo.com.br"));
        Assert.Equal("(11) *****-4321", p.Mascarar(PiiClasse.Telefone, "(11) 98765-4321"));
        Assert.Equal("ABC****", p.Mascarar(PiiClasse.Placa, "ABC1D23"));
        Assert.Equal("********", p.Mascarar(PiiClasse.Senha, "qualquer"));
        Assert.Equal("**.***.***-9", p.Mascarar(PiiClasse.Rg, "12.345.678-9"));
        Assert.Equal("***********7518", p.Mascarar(PiiClasse.Imei, "490154203237518"));
        Assert.Equal("[dado de saúde]", p.Mascarar(PiiClasse.Saude, "laudo F32")); }

    [Fact] public void Mascaras_nao_quebram_com_entrada_fora_do_formato() {   // SINTETICO
        var p = Novo();
        Assert.Equal("***", p.Mascarar(PiiClasse.Email, "sem-arroba"));
        Assert.Equal("(11) ****-4321", p.Mascarar(PiiClasse.Telefone, "1187654321"));
        Assert.Equal("(11) *****-4321", p.Mascarar(PiiClasse.Telefone, "+55 11 98765-4321"));
        Assert.Equal("*", p.Mascarar(PiiClasse.Placa, "A"));
        Assert.Equal("*******89", p.Mascarar(PiiClasse.Cpf, "1234567"+"89"));
        Assert.Equal("", p.Mascarar(PiiClasse.Rg, "")); }

    [Fact] public void Cifra_ida_e_volta_com_nonce_aleatorio() {
        var p = Novo(); var a = p.Cifrar("490154203237518"); var b = p.Cifrar("490154203237518");
        Assert.StartsWith("enc:v1:", a); Assert.NotEqual(a, b); Assert.True(p.EstaCifrado(a));
        Assert.Equal("490154203237518", p.Decifrar(a));
        Assert.Equal("", p.Decifrar(p.Cifrar(""))); }

    [Fact] public void Protetor_e_o_ICifrador_do_plano_02_e_le_o_formato_antigo() {   // SINTETICO
        var p = Novo(); ICifrador c = p; Assert.StartsWith("enc:v1:", c.Cifrar("490154203237518"));
        var antigo = new CifradorAesGcm(ChaveDeTesteBase64).Cifrar("490154203237518");   // mesma AMPARA_CRYPTO_KEY, formato do plano 02
        Assert.Equal("490154203237518", c.Decifrar(antigo)); Assert.False(p.EstaCifrado(antigo)); }

    [Fact] public void Adulteracao_e_chave_invalida_falham() {
        var a = Novo().Cifrar("x"); Assert.Throws<CryptographicException>(() => Novo().Decifrar(a[..^2] + "AA"));
        Assert.Throws<CryptographicException>(() => Novo().Decifrar("enc:v1:isto nao e base64!"));
        var ex = Assert.Throws<InvalidOperationException>(() => new PiiProtetor(ConfigSemChave()));
        Assert.Contains("AMPARA_CRYPTO_KEY", ex.Message);   // a mensagem não contém o valor da chave
        var curta = Convert.ToBase64String(new byte[16]);   // SINTETICO
        var ex2 = Assert.Throws<ArgumentException>(() => new PiiProtetor(Config(curta)));
        Assert.DoesNotContain(curta, ex2.Message); }

    [Fact] public void Container_registra_o_protetor_como_ICifrador_e_IPiiProtetor() {   // SINTETICO
        var sp = new ServiceCollection()
            .AddSingleton(Config(ChaveDeTesteBase64)).AddInfrastructure().BuildServiceProvider();
        var c = sp.GetRequiredService<ICifrador>();
        Assert.IsType<PiiProtetor>(c);
        Assert.Same(c, sp.GetRequiredService<IPiiProtetor>()); }
}
