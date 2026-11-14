using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber.Detectores;

namespace Ampara.Tests.Cyber;

public class DetectoresTests
{
    internal static IReadOnlyList<IPiiDetector> TodosDetectores() =>
    [
        new CpfDetector(), new RgDetector(), new ImeiDetector(), new TelefoneDetector(),
        new EmailDetector(), new PlacaDetector(), new SenhaDetector(), new SaudeDetector(),
    ];

    [Fact] public void Cpf_valido_com_e_sem_pontuacao() {   // SINTETICO
        Assert.Single(new CpfDetector().Detectar("cpf 529.982.247-25 ok"));
        Assert.Single(new CpfDetector().Detectar("52998224725"));
        Assert.Empty(new CpfDetector().Detectar("529.982.247-26"));     // DV inválido
        Assert.Empty(new CpfDetector().Detectar("111.111.111-11")); }

    [Fact] public void Cpf_com_digitos_fullwidth() =>   // Review Focus 3
        Assert.Single(new CpfDetector().Detectar(Normalizador.Normalizar(
            string.Concat("529.982.247-25".Select(c => char.IsAsciiDigit(c) ? (char)(c - '0' + 0xFF10) : c)))));

    [Fact] public void Cpf_com_nbsp() {
        var nbsp = ((char)0xA0).ToString();
        Assert.Single(new CpfDetector().Detectar(Normalizador.Normalizar("529" + nbsp + "982" + nbsp + "247" + nbsp + "25"))); }

    [Fact] public void Cpf_com_caractere_invisivel_no_meio() =>
        Assert.Single(new CpfDetector().Detectar(Normalizador.Normalizar("529\u200B.982.247\u2060-25")));

    [Fact] public void Imei_luhn_e_desempate() {
        Assert.Single(new ImeiDetector().Detectar("490154203237518"));
        Assert.Single(new ImeiDetector().Detectar("49-015420-323751-8"));
        Assert.Empty(new ImeiDetector().Detectar("490154203237519"));            // Luhn inválido
        Assert.Empty(new ImeiDetector().Detectar("4111111111111111"));           // 16 dígitos (cartão)
        Assert.Empty(new CpfDetector().Detectar("490154203237518")); }            // 15 dígitos nunca é CPF

    [Fact] public void Telefone_formatos() {
        Assert.Single(new TelefoneDetector().Detectar("(11) 98765-4321"));
        Assert.Single(new TelefoneDetector().Detectar("+55 11 98765-4321"));
        Assert.Single(new TelefoneDetector().Detectar("11987654321"));             // 11 dígitos, DV de CPF inválido
        Assert.Single(new TelefoneDetector().Detectar("(11) 3456-7890"));          // 10 dígitos com DDD
        Assert.Empty(new TelefoneDetector().Detectar("52998224725")); }            // é CPF válido

    [Fact] public void Rg_por_valor_so_no_formato_e_por_chave_qualquer_valor() {
        Assert.Single(new RgDetector().Detectar("rg 12.345.678-9"));
        Assert.Empty(new RgDetector().Detectar("123456789"));
        Assert.True(new RgDetector().ChaveIndica(Chaves.Normalizar("identidade")));
        Assert.True(new RgDetector().ChaveIndica("rg"));
        Assert.False(new RgDetector().ChaveIndica("organograma")); }              // 2 letras: só igualdade

    [Fact] public void Email_placa_e_senha_por_valor() {
        Assert.Single(new EmailDetector().Detectar("fale com ana.souza@exemplo.com.br hoje"));
        Assert.Empty(new EmailDetector().Detectar("sem arroba aqui.com"));
        Assert.Single(new PlacaDetector().Detectar("ABC1D23"));
        Assert.Single(new PlacaDetector().Detectar("placa ABC-1234"));
        Assert.Single(new PlacaDetector().Detectar("ABC1234"));
        var s = "minha senha: Abc12345!";
        var d = Assert.Single(new SenhaDetector().Detectar(s));
        Assert.Equal("Abc12345!", s.Substring(d.Inicio, d.Tamanho));              // cobre só o segredo
        Assert.Empty(new SenhaDetector().Detectar("esqueci minha senha")); }

    [Fact] public void Saude_termos_inteiros_sem_acento_e_sem_caixa() {
        Assert.Single(new SaudeDetector().Detectar("Laudo do paciente"));
        Assert.Single(new SaudeDetector().Detectar("tem DEPRESSÃO há anos"));
        Assert.Single(new SaudeDetector().Detectar("ATESTADO   MÉDICO anexo"));
        Assert.Single(new SaudeDetector().Detectar("CID-F32"));
        Assert.Empty(new SaudeDetector().Detectar("saúde"));                       // a palavra sozinha não é dado
        Assert.Empty(new SaudeDetector().Detectar("laudos")); }                    // termo inteiro

    [Fact] public void Nao_casa_decimais_guid_nem_jwt() {                          // Review Focus 1
        foreach (var s in new[]{"-23.5672490","-46.7019515","-23.56724901234","3f2b8c1e-5a4d-4e0b-9c7a-1d2e3f4a5b6c",
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Mjk5ODIyNDcyNSJ9.c2lnMTIzNDU2Nzg5MDE","11.222.333/0001-81","PP-2026-000001"})
            foreach (var d in TodosDetectores()) Assert.Empty(d.Detectar(Normalizador.Normalizar(s))); }

    [Fact] public void Chave_indica_classe() {
        Assert.True(new CpfDetector().ChaveIndica(Chaves.Normalizar("documento")));
        Assert.True(new SenhaDetector().ChaveIndica(Chaves.Normalizar("palavraSecreta")));
        Assert.True(new SenhaDetector().ChaveIndica(Chaves.Normalizar("X-Chave-Servico")));
        Assert.True(new TelefoneDetector().ChaveIndica(Chaves.Normalizar("telefone_contato")));
        Assert.Equal("palavrasecreta", Chaves.Normalizar("palavraSecreta"));
        Assert.Equal("diagnostico", Chaves.Normalizar("Diagnóstico"));
        Assert.False(new CpfDetector().ChaveIndica(Chaves.Normalizar("codigo"))); }

    [Fact] public void Detectores_nunca_lancam_com_emoji_surrogate_solto_e_fffd() {   // Review rodada 1, Important 1
        var emoji = char.ConvertFromUtf32(0x1F600);
        var solto = ((char)0xD800).ToString();
        var fffd = ((char)0xFFFD).ToString();
        foreach (var bruto in new[] { "ola " + emoji, "laudo " + emoji + " cpf 529.982.247-25", "a" + solto + "b", solto, ((char)0xDC00) + "x",
                                      "diagnostico" + solto + "depressao", "a" + fffd + "b", emoji + emoji + "hiv" })
        {
            var t = Normalizador.Normalizar(bruto);
            foreach (var d in TodosDetectores()) Assert.NotNull(d.Detectar(t));
        }
        Assert.Single(new SaudeDetector().Detectar(Normalizador.Normalizar("ola " + emoji + " tem DEPRESSÃO")));
        var t2 = Normalizador.Normalizar("laudo " + emoji);
        var m = Assert.Single(new SaudeDetector().Detectar(t2));
        Assert.Equal("laudo", t2.Substring(m.Inicio, m.Tamanho));
        Assert.Single(new CpfDetector().Detectar(Normalizador.Normalizar(emoji + " 529.982.247-25 " + solto)));
        Assert.Equal("a" + fffd + "b", Normalizador.Normalizar("a" + solto + "b")); }

    [Fact] public void Listas_sem_espaco_detectam_cada_item() {   // Review rodada 1, Important 2
        Assert.Equal(2, new CpfDetector().Detectar("52998224725,12345678909").Count);
        Assert.Equal(2, new CpfDetector().Detectar("529.982.247-25,123.456.789-09").Count);
        Assert.Equal(2, new CpfDetector().Detectar("cpfs=52998224725.12345678909").Count);
        Assert.Equal(2, new CpfDetector().Detectar("529.982.247-25;123.456.789-09").Count);
        Assert.Equal(2, new TelefoneDetector().Detectar("(11) 98765-4321,(21) 99876-5432").Count);
        Assert.Equal(2, new TelefoneDetector().Detectar("11987654321,21998765432").Count);
        Assert.Equal(2, new ImeiDetector().Detectar("490154203237518,490154203237518").Count);
        Assert.Equal(2, new RgDetector().Detectar("12.345.678-9,98.765.432-1").Count);
        Assert.Empty(new CpfDetector().Detectar("-23.56724901234"));          // decimal continua fora
        Assert.Empty(new CpfDetector().Detectar("1.529.982.247-25"));
        Assert.Empty(new CpfDetector().Detectar("-23,56724901234")); }   // decimal pt-BR com sinal continua fora

    [Fact] public void Documento_ao_lado_de_numero_curto_ou_texto_em_csv_continua_detectado() {   // Review rodada 2, Important 1
        foreach (var s in new[]{ "7,52998224725", "52998224725,3", "a1,52998224725", "1,2,52998224725", "529.982.247-25,3", "id,52998224725" })
            Assert.Single(new CpfDetector().Detectar(s));
        Assert.Single(new TelefoneDetector().Detectar("7,(11) 98765-4321"));
        Assert.Single(new TelefoneDetector().Detectar("11987654321,3"));
        Assert.Single(new ImeiDetector().Detectar("2,490154203237518"));
        Assert.Single(new ImeiDetector().Detectar("490154203237518,12"));
        Assert.Single(new RgDetector().Detectar("5,12.345.678-9"));
        Assert.Single(new RgDetector().Detectar("12.345.678-9,4")); }
}
