using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Domain.Cyber;
using Ampara.Domain.Entidades;
using Ampara.Infrastructure.Cyber;
using Microsoft.Extensions.Configuration;

namespace Ampara.Tests.Cyber;

public class ImeiNoBoTests(CyberApiFactory f) : IClassFixture<CyberApiFactory>
{
    private const string Imei = "490154203237518";   // SINTETICO
    private static readonly string Chave = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());   // SINTETICO
    private readonly PiiProtetor _protetor = new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_CRYPTO_KEY"] = Chave }).Build());

    private ImeiRevelador Novo(out RastroEmMemoria rastro)
    {
        rastro = new RastroEmMemoria();
        return new ImeiRevelador(_protetor, rastro, new AcessoIndevido(rastro));
    }

    [Fact] public void Dono_recebe_imei_e_fica_permitido_no_rastro()
    {
        var dono = Guid.NewGuid();
        var cifrado = _protetor.Cifrar(Imei);
        Assert.Equal(Imei, Novo(out var rastro).RevelarParaBo(cifrado, dono, dono));
        var e = Assert.Single(rastro.Eventos);
        Assert.Equal((Sink.HttpAutenticada, Decisao.Permitido, PiiClasse.Imei, "bo.imei"), (e.Sink, e.Decisao, e.Classe, e.Campo));
        Assert.Equal((dono, OrigemDado.Http), (e.UsuarioAlvoId, e.Source));
        Assert.Equal(0, IndiceRisco.Peso(e));
    }

    [Fact] public void Evento_do_dono_usa_o_correlation_id_recebido_e_nunca_guarda_o_imei()
    {
        var dono = Guid.NewGuid();
        Novo(out var rastro).RevelarParaBo(_protetor.Cifrar(Imei), dono, dono, "cid-abc");
        var e = Assert.Single(rastro.Eventos);
        Assert.Equal("cid-abc", e.CorrelationId);
        Assert.DoesNotContain(Imei, JsonSerializer.Serialize(e, new JsonSerializerOptions { IncludeFields = true }));
    }

    [Fact] public void Outro_usuario_vira_acesso_indevido_para_o_dono()
    {
        var dono = Guid.NewGuid(); var intruso = Guid.NewGuid();
        var cifrado = _protetor.Cifrar(Imei);
        var revelador = Novo(out var rastro);
        var ex = Assert.Throws<AcessoNegadoException>(() => revelador.RevelarParaBo(cifrado, dono, intruso));
        Assert.DoesNotContain(Imei, ex.Message);
        var e = Assert.Single(rastro.Eventos);
        Assert.Equal(40, IndiceRisco.Peso(e));
        Assert.Equal(dono, e.UsuarioAlvoId);
        Assert.NotEqual(Decisao.Permitido, e.Decisao);   // negado nunca aparece como permitido
    }

    [Fact] public async Task BO_pela_api_mostra_o_imei_ao_dono_e_nega_ao_intruso()
    {
        var v = await CyberTestHelpers.CriarVitimaComOcorrenciaAsync(f.CreateClient());
        var bo = await v.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo");
        Assert.Contains(Imei, bo.GetProperty("texto").GetString());

        var permitido = Assert.Single(f.Rastro.Eventos, e => e.Campo == "bo.imei" && e.UsuarioAlvoId == v.UsuarioId);
        Assert.Equal((Sink.HttpAutenticada, Decisao.Permitido, PiiClasse.Imei), (permitido.Sink, permitido.Decisao, permitido.Classe));
        Assert.Equal(permitido.Id, Assert.Single(await f.EventosNoBancoAsync(v.UsuarioId), e => e.Campo == "bo.imei").Id);   // gravado no repositório

        var i = await CyberTestHelpers.CriarUsuarioAsync(f.CreateClient());
        var negado = await i.Cliente.GetAsync($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo");
        Assert.Equal(HttpStatusCode.Forbidden, negado.StatusCode);
        Assert.Equal("application/problem+json", negado.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain(Imei, await negado.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo")).StatusCode);

        // O intruso virou acesso indevido para a VÍTIMA (peso 40) e o IMEI não saiu.
        var indevidos = (await f.EventosNoBancoAsync(v.UsuarioId)).Where(IndiceRisco.EhAcessoIndevido).ToList();
        Assert.Single(indevidos);
        Assert.Equal(40, IndiceRisco.Peso(indevidos[0]));
        Assert.Equal(1, f.Rastro.Eventos.Count(e => e.Campo == "bo.imei" && e.UsuarioAlvoId == v.UsuarioId));
    }

    [Fact] public async Task Imei_nunca_sai_em_resposta_anonima_nem_em_log()
    {
        var anonimo = f.CreateClient();
        var v = await CyberTestHelpers.CriarVitimaComOcorrenciaAsync(f.CreateClient());
        (await v.Cliente.GetAsync($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo")).EnsureSuccessStatusCode();   // o IMEI existe em claro na resposta autenticada

        var anonima = await anonimo.GetAsync($"/api/v1/ocorrencias/{v.OcorrenciaId}/bo");
        Assert.DoesNotContain(Imei, await anonima.Content.ReadAsStringAsync());
        // Rotas autenticadas que listam o aparelho mostram só os 4 últimos dígitos.
        Assert.DoesNotContain(Imei, await v.Cliente.GetStringAsync("/api/v1/aparelhos"));
        Assert.DoesNotContain(f.Log.Linhas, l => l.Contains(Imei));
    }

    [Fact] public async Task Imei_fica_cifrado_no_banco()
    {
        var u = await CyberTestHelpers.CriarUsuarioAsync(f.CreateClient());
        (await u.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = Imei, marca = "MarcaTeste", modelo = "ModeloTeste" })).EnsureSuccessStatusCode();
        using var db = f.NovoDb();
        var a = db.Aparelhos.Single(x => x.UsuarioId == u.UsuarioId);
        Assert.StartsWith("enc:v1:", a.ImeiCifrado);
        Assert.DoesNotContain(Imei, a.ImeiCifrado);
    }
}
