using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ampara.Application.Comum;
using Ampara.Domain.Comum;
using Ampara.Infrastructure;
using Ampara.Infrastructure.Cripto;
using Ampara.Infrastructure.Cyber;

namespace Ampara.Tests.Testes;

public class PrimitivasTests
{
    [Fact] public void Imei_luhn() {   // SINTETICO: IMEI de exemplo publico
        Assert.True(Imei.Valido("490154203237518")); Assert.False(Imei.Valido("490154203237519"));
        Assert.False(Imei.Valido("49015420323751")); Assert.False(Imei.Valido("49015420323751A")); Assert.False(Imei.Valido(null));
        Assert.Equal("490154203237518", Imei.Normalizar(" 49-015420-323751-8 ")); }
    [Fact] public void Area_referencia_do_contrato() {
        Assert.Equal("g051_026", AreaMapa.AreaId(-23.5672490, -46.7019515));
        Assert.Equal("g000_000", AreaMapa.AreaId(-23.80, -46.83));
        Assert.Equal("fora", AreaMapa.AreaId(-23.34, -46.70)); Assert.Equal("fora", AreaMapa.AreaId(-23.60, -46.90));
        var c = AreaMapa.Centro("g051_026")!.Value; Assert.Equal(-23.80 + 51.5 * 0.0045, c.Lat, 9); Assert.Equal(-46.83 + 26.5 * 0.0049, c.Lng, 9);
        Assert.Null(AreaMapa.Centro("fora")); }
    [Fact] public void Faixa_e_dia_em_hora_de_sao_paulo() {
        var t = new DateTime(2026, 11, 14, 21, 42, 0, DateTimeKind.Utc);      // 18h42 de sabado em SP
        Assert.Equal(6, AreaMapa.Faixa(t)); Assert.Equal(5, AreaMapa.DiaSemana(t));
        var u = new DateTime(2026, 11, 14, 2, 30, 0, DateTimeKind.Utc);       // 23h30 de sexta em SP
        Assert.Equal(7, AreaMapa.Faixa(u)); Assert.Equal(4, AreaMapa.DiaSemana(u)); }
    [Fact] public void DeviceHash_vetor() => Assert.Equal("17977c26827a82fa3900a9b718028acf0ee5d1bac3f2040ed78b3fa4c2dde560",
        DeviceHash.Calcular("chaveiro-ampara-a1b2c3", "chave-teste-sintetica"));
    [Fact] public void DeviceHash_sem_chaveiro_segue_o_contrato() { var id = Guid.Parse("3f2b8c1e-5a4d-4e0b-9c7a-1d2e3f4a5b6c");
        var esperado = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("sem-chaveiro-" + id + "chave-teste-sintetica"))).ToLowerInvariant();
        Assert.Equal(esperado, DeviceHash.SemChaveiro(id, "chave-teste-sintetica")); Assert.Equal(64, esperado.Length); }
    [Fact] public void Imei_revelador_noop_so_decifra() { var c = new CifradorAesGcm(Convert.ToBase64String(new byte[32]));   // SINTETICO
        var dono = Guid.NewGuid(); Assert.Equal("490154203237518", new NoopImeiRevelador(c).RevelarParaBo(c.Cifrar("490154203237518"), dono, dono)); }
    [Fact] public void Distancia_pinheiros_se_e_zero_para_o_mesmo_ponto() {
        var d = Geo.DistanciaMetros(-23.5672490, -46.7019515, -23.5503, -46.6339); Assert.InRange(d, 7000, 7400);
        Assert.Equal(0, Geo.DistanciaMetros(1, 1, 1, 1), 6); }
    [Fact] public void Cifra_aesgcm() {
        var c = new CifradorAesGcm(Convert.ToBase64String(new byte[32]));   // chave de teste
        var a = c.Cifrar("490154203237518"); var b = c.Cifrar("490154203237518");
        Assert.NotEqual(a, b); Assert.Equal("490154203237518", c.Decifrar(a)); Assert.DoesNotContain("4901542", a);
        
        Assert.Throws<ArgumentException>(() => new CifradorAesGcm(Convert.ToBase64String(new byte[16]))); }

    [Theory]
    [InlineData(0)]    // nonce
    [InlineData(12)]   // tag
    [InlineData(28)]   // ciphertext
    public void Cifra_aesgcm_rejeita_byte_alterado(int posicao) {
        var c = new CifradorAesGcm(Convert.ToBase64String(new byte[32]));   // SINTETICO
        var bruto = Convert.FromBase64String(c.Cifrar("490154203237518"));
        Assert.Equal(43, bruto.Length);
        bruto[posicao] ^= 1;
        var adulterado = Convert.ToBase64String(bruto);   // base64 valido: so a autenticacao do GCM pode recusar
        Assert.ThrowsAny<CryptographicException>(() => c.Decifrar(adulterado));
    }
    [Fact] public void Cifra_aesgcm_rejeita_entrada_curta_ou_invalida() {
        var c = new CifradorAesGcm(Convert.ToBase64String(new byte[32]));   // SINTETICO
        Assert.Throws<CryptographicException>(() => c.Decifrar(Convert.ToBase64String(new byte[27])));
        Assert.Throws<CryptographicException>(() => c.Decifrar("isto nao e base64!"));
    }
    [Fact] public void Subida_falha_sem_chave_ou_com_chave_de_tamanho_errado() {
        static ICifrador Resolver(string? chave) {
            var dados = new Dictionary<string, string?>();
            if (chave is not null) dados["AMPARA_CRYPTO_KEY"] = chave;
            var config = new ConfigurationBuilder().AddInMemoryCollection(dados).Build();
            var sp = new ServiceCollection().AddSingleton<IConfiguration>(config).AddInfrastructure().BuildServiceProvider();
            return sp.GetRequiredService<ICifrador>();
        }
        Assert.Throws<InvalidOperationException>(() => Resolver(null));
        Assert.Throws<ArgumentException>(() => Resolver(Convert.ToBase64String(new byte[16])));   // SINTETICO
        Assert.NotNull(Resolver(Convert.ToBase64String(new byte[32])));                           // SINTETICO
    }
}
