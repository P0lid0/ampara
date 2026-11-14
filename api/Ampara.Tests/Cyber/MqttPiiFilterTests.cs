using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Ampara.Tests.Cyber;

public class MqttPiiFilterTests
{
    private static readonly string Chave = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO

    private static MqttPiiFilter Novo(out RastroEmMemoria rastro)
    {
        var r = rastro = new RastroEmMemoria();
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build();
        var scanner = new PiiScanner(DetectoresTests.TodosDetectores());
        var sp = new ServiceCollection()
            .AddSingleton<IPiiScanner>(scanner)
            .AddSingleton<IPiiProtetor>(new PiiProtetor(cfg))
            .AddSingleton<IRastroSeguranca>(r)
            .AddSingleton(Options.Create(new CyberOptions { TaintAtivo = true }))
            .AddScoped<ITaintScope, TaintScope>()
            .AddScoped<ITaintGuard, TaintGuard>()
            .BuildServiceProvider();
        return new MqttPiiFilter(sp.GetRequiredService<IServiceScopeFactory>(), scanner);
    }

    [Fact] public void Payload_com_cpf_sai_mascarado_com_rastro_mqtt() {   // SINTETICO
        var f = Novo(out var rastro);
        var saida = f.Filtrar("citizentech/chaveiro/chaveiro-ampara-a1b2c3/events",
            """{"deviceId":"chaveiro-ampara-a1b2c3","type":"alert","eventId":"e-001","ts":"2026-11-14T12:00:00Z","nota":"cpf 529.982.247-25"}""");
        var o = JsonDocument.Parse(saida).RootElement;
        Assert.Equal("chaveiro-ampara-a1b2c3", o.GetProperty("deviceId").GetString()); Assert.Equal("e-001", o.GetProperty("eventId").GetString());
        Assert.Contains("***.982.***-25", o.GetProperty("nota").GetString());
        var e = Assert.Single(rastro.Eventos); Assert.Equal((OrigemDado.Mqtt, Sink.Banco, PiiClasse.Cpf, "nota"), (e.Source, e.Sink, e.Classe, e.Campo)); }

    [Fact] public void Payload_do_contrato_sem_pii_volta_igual_e_sem_eventos() {
        var p = """{"deviceId":"chaveiro-ampara-a1b2c3","type":"low_battery","eventId":"e-002","ts":"2026-11-14T12:00:00Z","battery":18}""";
        Assert.Same(p, Novo(out var r).Filtrar("t", p)); Assert.Empty(r.Eventos); }

    [Fact] public void Payload_binario_ou_invalido_nao_lanca() => Assert.Equal("[payload inválido]", Novo(out _).Filtrar("t", "\u0000\u0001{{{"));

    [Fact] public void Cada_mensagem_tem_correlation_id_proprio() {   // SINTETICO
        var f = Novo(out var r);
        var p = """{"deviceId":"d","type":"alert","eventId":"e","ts":1,"nota":"cpf 529.982.247-25"}""";
        f.Filtrar("t", p); f.Filtrar("t", p);
        Assert.Equal(2, r.Eventos.Count); Assert.NotEqual(r.Eventos[0].CorrelationId, r.Eventos[1].CorrelationId);
        Assert.All(r.Eventos, e => Assert.False(string.IsNullOrEmpty(e.CorrelationId)));
        f.Filtrar("t", p, "abc-123"); Assert.Equal("abc-123", r.Eventos[2].CorrelationId); }

    [Fact] public void Ts_em_segundos_unix_de_10_digitos_segue_intacto() {   // SINTETICO
        var f = Novo(out var r);
        var saida = f.Filtrar("t", """{"eventId":"c-17","type":"alert","deviceId":"chaveiro-ampara-a1b2c3","ts":1794700000,"ageMs":140,"battery":82,"nota":"cpf 529.982.247-25"}""");
        var o = JsonDocument.Parse(saida).RootElement;
        Assert.Equal(1794700000, o.GetProperty("ts").GetInt64()); Assert.Equal(82, o.GetProperty("battery").GetInt32());
        Assert.Equal(JsonValueKind.Number, o.GetProperty("ts").ValueKind);
        Assert.Single(r.Eventos);
        var p = """{"eventId":"c-17","type":"alert","deviceId":"d","ts":1794700000,"battery":82}""";
        Assert.Same(p, f.Filtrar("t", p)); }

    [Fact] public void Valor_em_array_aninhado_e_achado_pelo_caminho() {   // SINTETICO
        var f = Novo(out var r);
        var saida = f.Filtrar("t", """{"deviceId":"d","type":"alert","eventId":"e","ts":1,"contatos":[{"obs":"x"},{"obs":"cpf 529.982.247-25"}]}""");
        Assert.Contains("***.982.***-25", JsonDocument.Parse(saida).RootElement.GetProperty("contatos")[1].GetProperty("obs").GetString());
        Assert.Equal("contatos[1].obs", Assert.Single(r.Eventos).Campo); }

    [Fact] public void Valor_denunciado_so_pela_chave_nao_sai_em_claro() {   // SINTETICO
        var f = Novo(out var r);
        var saida = f.Filtrar("t", """{"deviceId":"d","type":"alert","eventId":"e","ts":1,"senha":"abc12345"}""");
        Assert.DoesNotContain("abc12345", saida);
        Assert.Equal(PiiClasse.Senha, Assert.Single(r.Eventos).Classe); }

    [Fact] public void Imei_sai_cifrado() {   // SINTETICO
        var f = Novo(out var r);
        var saida = f.Filtrar("t", """{"deviceId":"d","type":"alert","eventId":"e","ts":1,"imei":"490154203237518"}""");
        Assert.DoesNotContain("490154203237518", saida);
        var e = Assert.Single(r.Eventos); Assert.Equal((PiiClasse.Imei, Decisao.Cifrado), (e.Classe, e.Decisao)); }
}
