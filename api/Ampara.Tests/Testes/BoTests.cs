using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Domain;
using Ampara.Domain.Entidades;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Tests;

public class BoTests(AmparaFactory f) : IClassFixture<AmparaFactory>
{
    private const string Imei = "490154203237518";   // SINTETICO (Luhn valido)
    private const string Codigo = "123456";
    private const string Palavra = "palavra-sintetica";   // SINTETICO
    private static readonly DateTime Momento = new(2026, 11, 14, 21, 42, 0, DateTimeKind.Utc);

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    private async Task<Guid> OcorrenciaAsync(Sessao dono, bool comMomento = true)
    {
        using var db = f.NovoDb();
        var o = Ocorrencia.Iniciar(dono.UsuarioId, OrigemGatilho.Web, Momento.AddMinutes(1));
        if (comMomento) o.MarcarMomento(Momento, -23.5672490, -46.7019515, Momento.AddMinutes(2));   // Pinheiros
        db.Ocorrencias.Add(o);
        await db.SaveChangesAsync();
        return o.Id;
    }

    private static async Task AparelhoAsync(Sessao dono) =>
        (await dono.Cliente.PostAsJsonAsync("/api/v1/aparelhos", new { imei = Imei, marca = "MarcaTeste", modelo = "ModeloTeste" })).EnsureSuccessStatusCode();

    private async Task<HttpClient> EmergenciaAsync(Sessao s)
    {
        (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).EnsureSuccessStatusCode();
        return await f.ClienteEmergenciaAsync(s.Email, Codigo, Palavra);
    }

    [Fact]
    public async Task Dono_recebe_texto_com_imei_hora_local_e_delegacia()
    {
        var dono = await f.NovoUsuarioAsync(); await AparelhoAsync(dono);
        var id = await OcorrenciaAsync(dono);

        var r = await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/bo");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var bo = await r.Content.ReadFromJsonAsync<JsonElement>();
        var texto = bo.GetProperty("texto").GetString()!;
        Assert.Contains("BOLETIM DE OCORRÊNCIA - RASCUNHO GERADO PELO AMPARA", texto);
        Assert.Contains("Natureza: Roubo de aparelho celular", texto);
        Assert.Contains("Data e hora do fato: 14/11/2026 18:42 (horário de Brasília)", texto);
        // O último dígito de -46.7019515 depende do arredondamento binário; só o prefixo e o formato importam.
        Assert.Matches(@"Local: coordenadas -23\.567249, -46\.70195\d \(aproximadas\), São Paulo/SP", texto);
        Assert.Contains("Aparelho: MarcaTeste ModeloTeste", texto);
        Assert.Contains("IMEI: 490154203237518", texto);
        Assert.Contains("Descrição: ", texto);
        Assert.Contains("conferido antes de registrar", texto);
        var d = bo.GetProperty("delegacia");
        Assert.Equal("Delegacia Teste A", d.GetProperty("nome").GetString());
        Assert.False(string.IsNullOrWhiteSpace(d.GetProperty("endereco").GetString()));
        Assert.Equal(-23.5670, d.GetProperty("lat").GetDouble());
        Assert.Equal(-46.7020, d.GetProperty("lng").GetDouble());
        Assert.Equal("https://www.delegaciaeletronica.policiacivil.sp.gov.br/", bo.GetProperty("linkDelegaciaEletronica").GetString());
    }

    [Fact]
    public async Task Sem_aparelho_diz_imei_nao_informado()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        var antes = f.ImeiRevelador.Chamadas.Count(c => c.DonoId == dono.UsuarioId);

        var bo = await dono.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}/bo");
        var texto = bo.GetProperty("texto").GetString()!;
        Assert.Contains("IMEI: não informado", texto);
        Assert.Contains("Aparelho: não informado", texto);
        Assert.Equal(antes, f.ImeiRevelador.Chamadas.Count(c => c.DonoId == dono.UsuarioId));   // sem IMEI, nada a revelar
    }

    [Fact]
    public async Task Sem_momento_409()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono, comMomento: false);
        var r = await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/bo");
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("momento-nao-marcado", await CodigoDoErroAsync(r));
    }

    [Fact]
    public async Task Guardiao_403_e_estranho_403()
    {
        var dono = await f.NovoUsuarioAsync(); await AparelhoAsync(dono);
        var g = await f.VincularGuardiaoAsync(dono);
        var estranho = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        f.Acesso.Limpar();

        foreach (var outro in new[] { g, estranho })
        {
            var r = await outro.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/bo");
            Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
            Assert.Equal("ocorrencia-de-outro-usuario", await CodigoDoErroAsync(r));
        }
        Assert.Equal(2, f.Acesso.Chamadas.Count(c => c.UsuarioAlvoId == dono.UsuarioId && c.Campo == "recurso-de-outro-usuario"));
        Assert.DoesNotContain(f.ImeiRevelador.Chamadas, c => c.DonoId == dono.UsuarioId);   // nada foi revelado
    }

    [Fact]
    public async Task Ocorrencia_inexistente_404_e_sem_token_401()
    {
        var dono = await f.NovoUsuarioAsync();
        var r = await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{Guid.NewGuid()}/bo");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("ocorrencia-nao-encontrada", await CodigoDoErroAsync(r));
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync($"/api/v1/ocorrencias/{Guid.NewGuid()}/bo")).StatusCode);
    }

    [Fact]
    public async Task Emergencia_do_dono_gera_o_bo()
    {
        var dono = await f.NovoUsuarioAsync(); await AparelhoAsync(dono);
        var id = await OcorrenciaAsync(dono);
        var em = await EmergenciaAsync(dono);

        var r = await em.GetAsync($"/api/v1/ocorrencias/{id}/bo");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("IMEI: 490154203237518", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("texto").GetString());
    }

    [Fact]
    public async Task Rascunho_fica_cifrado_no_banco_e_regerar_mantem_um_registro()
    {
        var dono = await f.NovoUsuarioAsync(); await AparelhoAsync(dono);
        var id = await OcorrenciaAsync(dono);

        (await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/bo")).EnsureSuccessStatusCode();
        (await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/bo")).EnsureSuccessStatusCode();

        using var db = f.NovoDb();
        var rascunho = await db.BosRascunho.SingleAsync(b => b.OcorrenciaId == id);
        Assert.DoesNotContain(Imei, rascunho.TextoCifrado);
        Assert.DoesNotContain("Natureza", rascunho.TextoCifrado);
        Assert.Equal("Delegacia Teste A", rascunho.DelegaciaNome);
        Assert.Equal(1, await db.BosRascunho.CountAsync(b => b.OcorrenciaId == id));
    }

    [Fact]
    public async Task Bo_obtem_o_imei_pelo_revelador()
    {
        var dono = await f.NovoUsuarioAsync(); await AparelhoAsync(dono);
        var id = await OcorrenciaAsync(dono);
        var em = await EmergenciaAsync(dono);
        using var db = f.NovoDb();
        var cifrado = (await db.Aparelhos.SingleAsync(a => a.UsuarioId == dono.UsuarioId)).ImeiCifrado;

        var texto1 = (await dono.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}/bo")).GetProperty("texto").GetString()!;
        var texto2 = (await em.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}/bo")).GetProperty("texto").GetString()!;

        var chamadas = f.ImeiRevelador.Chamadas.Where(c => c.DonoId == dono.UsuarioId).ToList();
        Assert.Equal(2, chamadas.Count);   // uma por requisição (a do token de usuário e a do de emergência)
        Assert.All(chamadas, c =>
        {
            Assert.Equal(cifrado, c.ImeiCifrado);
            Assert.Equal(dono.UsuarioId, c.SolicitanteId);
        });
        Assert.Contains($"IMEI: {chamadas[0].Retorno}", texto1);
        Assert.Contains($"IMEI: {chamadas[1].Retorno}", texto2);
    }
}
