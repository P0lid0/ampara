using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Policia;
using Ampara.Domain;
using Ampara.Domain.Comum;
using Ampara.Domain.Entidades;
using Ampara.Tests.Infra;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Tests;

// Uma fábrica por teste: o protocolo da Ponte falsa é sequencial e cada teste confere a lista do que a Ponte recebeu.
public class PoliciaTests : IDisposable
{
    private const string Chave = AmparaFactory.ChaveServicoTeste;
    private const string Codigo = "123456";               // SINTETICO
    private const string Palavra = "palavra-sintetica";   // SINTETICO
    private const string Device = "chaveiro-ampara-a1b2c3";
    private static readonly DateTime Momento = new(2026, 11, 14, 21, 42, 0, DateTimeKind.Utc);

    private readonly AmparaFactory f = new();

    public void Dispose() => f.Dispose();

    private static async Task<string> CodigoDoErroAsync(HttpResponseMessage r)
    {
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString()!;
    }

    // Pinheiros (-23.567249, -46.7019515) cai na área g051_026 da grade.
    private async Task<Guid> OcorrenciaAsync(Sessao dono, bool comMomento = true, OrigemGatilho origem = OrigemGatilho.Web, string? deviceId = null)
    {
        using var db = f.NovoDb();
        var o = Ocorrencia.Iniciar(dono.UsuarioId, origem, Momento.AddMinutes(1));
        if (comMomento) o.MarcarMomento(Momento, -23.5672490, -46.7019515, Momento.AddMinutes(2));
        if (deviceId is not null) typeof(Ocorrencia).GetProperty(nameof(Ocorrencia.ChaveiroDeviceId))!.SetValue(o, deviceId);
        db.Ocorrencias.Add(o);
        await db.SaveChangesAsync();
        return o.Id;
    }

    private async Task PontosAsync(Sessao dono, params DateTime[] instantes)
    {
        using var db = f.NovoDb();
        foreach (var em in instantes) db.Pontos.Add(PontoRota.Criar(dono.UsuarioId, -23.5, -46.7, 5, em));
        await db.SaveChangesAsync();
    }

    private async Task<HttpClient> EmergenciaAsync(Sessao s)
    {
        (await s.Cliente.PutAsJsonAsync("/api/v1/me/emergencia", new { codigo = Codigo, palavraSecreta = Palavra })).EnsureSuccessStatusCode();
        return await f.ClienteEmergenciaAsync(s.Email, Codigo, Palavra);
    }

    private static Task<HttpResponseMessage> Compartilhar(HttpClient c, Guid id, bool consentimento = true) =>
        c.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/compartilhar-policia", new { consentimento });

    [Fact]
    public async Task Compartilha_com_consentimento_e_grava_protocolo()
    {
        var dono = await f.NovoUsuarioAsync();
        (await dono.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = Device })).EnsureSuccessStatusCode();
        var id = await OcorrenciaAsync(dono, origem: OrigemGatilho.Chaveiro, deviceId: Device);

        var r = await Compartilhar(dono.Cliente, id);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("PP-2026-000001", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("protocolo").GetString());

        var e = f.Ponte.Enviadas.Single();
        Assert.Equal(id, e.OrigemId);
        Assert.Equal("g051_026", e.AreaId);
        Assert.Equal(Momento, e.Ts);
        Assert.Equal("roubo_celular", e.Tipo);
        Assert.Equal("chaveiro", e.OrigemGatilho);
        Assert.Equal(DeviceHash.Calcular(Device, Chave), e.DeviceHash);
        Assert.Equal("PP-2026-000001", f.NovoDb().Ocorrencias.Single(o => o.Id == id).ProtocoloPolicia);
    }

    [Fact]
    public async Task Sem_chaveiro_na_ocorrencia_usa_o_primeiro_chaveiro_do_dono()
    {
        var dono = await f.NovoUsuarioAsync();
        (await dono.Cliente.PostAsJsonAsync("/api/v1/chaveiros", new { deviceId = Device })).EnsureSuccessStatusCode();
        var id = await OcorrenciaAsync(dono);   // ocorrência web, sem ChaveiroDeviceId

        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();
        Assert.Equal(DeviceHash.Calcular(Device, Chave), f.Ponte.Enviadas.Single().DeviceHash);
        Assert.Equal("web", f.Ponte.Enviadas.Single().OrigemGatilho);
    }

    [Fact]
    public async Task Sem_chaveiro_o_device_hash_segue_o_contrato()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);

        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();
        var hash = f.Ponte.Enviadas.Single().DeviceHash;
        Assert.Equal(DeviceHash.SemChaveiro(id, Chave), hash);
        var esperado = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("sem-chaveiro-" + id + Chave))).ToLowerInvariant();
        Assert.Equal(esperado, hash);
    }

    [Fact]
    public async Task Segunda_chamada_devolve_o_mesmo_protocolo_sem_reenviar()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);

        var a = (await (await Compartilhar(dono.Cliente, id)).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("protocolo").GetString();
        // Mesmo que a Ponte caia, quem já tem protocolo recebe o mesmo sem chamá-la.
        f.Ponte.Falhar = true;
        var r = await Compartilhar(dono.Cliente, id);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(a, (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("protocolo").GetString());
        Assert.Single(f.Ponte.Enviadas);
    }

    [Fact]
    public async Task Sem_consentimento_422_sem_momento_409_guardiao_403()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);

        var sem = await Compartilhar(dono.Cliente, id, consentimento: false);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, sem.StatusCode);
        Assert.Equal("consentimento-ausente", await CodigoDoErroAsync(sem));
        var vazio = await dono.Cliente.PostAsJsonAsync($"/api/v1/ocorrencias/{id}/compartilhar-policia", new { });
        Assert.Equal("consentimento-ausente", await CodigoDoErroAsync(vazio));
        var semCorpo = await dono.Cliente.PostAsync($"/api/v1/ocorrencias/{id}/compartilhar-policia", null);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, semCorpo.StatusCode);

        var dono2 = await f.NovoUsuarioAsync();
        var idSem = await OcorrenciaAsync(dono2, comMomento: false);
        var r409 = await Compartilhar(dono2.Cliente, idSem);
        Assert.Equal(HttpStatusCode.Conflict, r409.StatusCode);
        Assert.Equal("momento-nao-marcado", await CodigoDoErroAsync(r409));

        var guardiao = await f.VincularGuardiaoAsync(dono);
        f.Acesso.Limpar();
        var r403 = await Compartilhar(guardiao.Cliente, id);
        Assert.Equal(HttpStatusCode.Forbidden, r403.StatusCode);
        Assert.Contains(f.Acesso.Chamadas, c => c.Campo == "recurso-de-outro-usuario" && c.UsuarioAlvoId == dono.UsuarioId);
        Assert.Empty(f.Ponte.Enviadas);
    }

    [Fact]
    public async Task Trilha_so_com_consentimento_de_rota_e_so_apos_o_momento()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        await PontosAsync(dono, Momento.AddMinutes(-5), Momento, Momento.AddMinutes(3), Momento.AddMinutes(1));

        // Sem ConsentimentoRota: trilha vazia, mesmo havendo pontos.
        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();
        Assert.Empty(f.Ponte.Enviadas.Single().Trilha);

        var dono2 = await f.NovoUsuarioAsync();
        (await dono2.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = true })).EnsureSuccessStatusCode();
        var id2 = await OcorrenciaAsync(dono2);
        await PontosAsync(dono2, Momento.AddMinutes(-5), Momento, Momento.AddMinutes(3), Momento.AddMinutes(1));
        (await Compartilhar(dono2.Cliente, id2)).EnsureSuccessStatusCode();

        var trilha = f.Ponte.Enviadas.Single(e => e.OrigemId == id2).Trilha;
        Assert.Equal([Momento, Momento.AddMinutes(1), Momento.AddMinutes(3)], trilha.Select(p => p.Em).ToArray());   // sem o ponto anterior, em ordem crescente
        Assert.All(trilha, p => Assert.Equal(DateTimeKind.Utc, p.Em.Kind));
    }

    [Fact]
    public async Task Trilha_e_limitada_a_500_pontos()
    {
        var dono = await f.NovoUsuarioAsync();
        (await dono.Cliente.PutAsJsonAsync("/api/v1/me/consentimento-rota", new { aceito = true })).EnsureSuccessStatusCode();
        var id = await OcorrenciaAsync(dono);
        await PontosAsync(dono, Enumerable.Range(0, 520).Select(i => Momento.AddSeconds(i)).ToArray());

        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();
        var trilha = f.Ponte.Enviadas.Single().Trilha;
        Assert.Equal(500, trilha.Count);
        Assert.Equal(Momento, trilha[0].Em);
        Assert.Equal(Momento.AddSeconds(499), trilha[^1].Em);
    }

    [Fact]
    public async Task Ponte_fora_do_ar_da_502_nao_marca_enviado_e_nova_tentativa_funciona()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);

        f.Ponte.Falhar = true;
        var r = await Compartilhar(dono.Cliente, id);
        Assert.Equal(HttpStatusCode.BadGateway, r.StatusCode);
        Assert.Equal("ponte-indisponivel", await CodigoDoErroAsync(r));
        Assert.Null(f.NovoDb().Ocorrencias.Single(o => o.Id == id).ProtocoloPolicia);

        f.Ponte.Falhar = false;
        var ok = await Compartilhar(dono.Cliente, id);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var protocolo = (await ok.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("protocolo").GetString();
        Assert.Equal(protocolo, f.NovoDb().Ocorrencias.Single(o => o.Id == id).ProtocoloPolicia);
    }

    [Fact]
    public async Task Retorno_mapeia_para_camelCase_e_exige_compartilhamento()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);

        var antes = await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/retorno");
        Assert.Equal(HttpStatusCode.NotFound, antes.StatusCode);
        Assert.Equal("ocorrencia-nao-compartilhada", await CodigoDoErroAsync(antes));

        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();
        var r = await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/retorno");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("PP-2026-000001", j.GetProperty("protocolo").GetString());
        Assert.Equal("recebida", j.GetProperty("status").GetString());
        Assert.Equal("Recebemos o seu relato.", j.GetProperty("mensagem").GetString());
        Assert.Equal(new DateTime(2026, 11, 14, 22, 0, 0, DateTimeKind.Utc), j.GetProperty("atualizadoEm").GetDateTime().ToUniversalTime());
        Assert.Equal(JsonValueKind.Null, j.GetProperty("boNumero").ValueKind);
        Assert.Equal("nao_registrado", j.GetProperty("boStatus").GetString());
        Assert.Equal("sem_noticia", j.GetProperty("recuperacao").GetString());
        Assert.Equal(7, j.EnumerateObject().Count());

        // Ponte sem o protocolo (404) -> retorno-indisponivel; Ponte fora do ar -> 502.
        f.Ponte.Retorno = _ => null;
        var indisp = await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/retorno");
        Assert.Equal(HttpStatusCode.NotFound, indisp.StatusCode);
        Assert.Equal("retorno-indisponivel", await CodigoDoErroAsync(indisp));
        f.Ponte.Falhar = true;
        Assert.Equal(HttpStatusCode.BadGateway, (await dono.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/retorno")).StatusCode);
    }

    [Fact]
    public async Task Retorno_de_guardiao_403()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();
        var guardiao = await f.VincularGuardiaoAsync(dono);
        Assert.Equal(HttpStatusCode.Forbidden, (await guardiao.Cliente.GetAsync($"/api/v1/ocorrencias/{id}/retorno")).StatusCode);
    }

    [Fact]
    public async Task Acompanhamento_204_aparece_no_retorno_e_valores_invalidos_422()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        var url = $"/api/v1/ocorrencias/{id}/acompanhamento";

        // Não exige compartilhamento com a polícia.
        var r = await dono.Cliente.PutAsJsonAsync(url, new { boNumero = "2026/123456", boStatus = "registrado", recuperacao = "localizado" });
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();

        var j = await dono.Cliente.GetFromJsonAsync<JsonElement>($"/api/v1/ocorrencias/{id}/retorno");
        Assert.Equal("2026/123456", j.GetProperty("boNumero").GetString());
        Assert.Equal("registrado", j.GetProperty("boStatus").GetString());
        Assert.Equal("localizado", j.GetProperty("recuperacao").GetString());
        Assert.Equal("PP-2026-000001", j.GetProperty("protocolo").GetString());

        // Token de emergência do dono também pode.
        var emergencia = await EmergenciaAsync(dono);
        Assert.Equal(HttpStatusCode.NoContent, (await emergencia.PutAsJsonAsync(url, new { boStatus = "nao_registrado", recuperacao = "recuperado" })).StatusCode);

        foreach (var ruim in new object[]
        {
            new { boStatus = "talvez", recuperacao = "sem_noticia" },
            new { boStatus = "registrado", recuperacao = "perdido" },
            new { boNumero = new string('9', 41), boStatus = "registrado", recuperacao = "sem_noticia" },
            new { recuperacao = "sem_noticia" },
        })
        {
            var e = await dono.Cliente.PutAsJsonAsync(url, ruim);
            Assert.Equal(HttpStatusCode.UnprocessableEntity, e.StatusCode);
            Assert.Equal("acompanhamento-invalido", await CodigoDoErroAsync(e));
        }
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await dono.Cliente.PutAsync(url, null)).StatusCode);

        // 40 caracteres passa; o banco guarda os três campos (o último PUT válido foi o da emergência: sem número).
        Assert.Equal(HttpStatusCode.NoContent, (await dono.Cliente.PutAsJsonAsync(url, new { boNumero = new string('9', 40), boStatus = "registrado", recuperacao = "sem_noticia" })).StatusCode);
        var o = f.NovoDb().Ocorrencias.Single(x => x.Id == id);
        Assert.Equal((new string('9', 40), "registrado", "sem_noticia"), (o.BoNumero, o.BoStatus, o.Recuperacao));
    }

    [Fact]
    public async Task Acompanhamento_de_guardiao_ou_estranho_403_com_registro()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        var guardiao = await f.VincularGuardiaoAsync(dono);
        var estranho = await f.NovoUsuarioAsync();
        var url = $"/api/v1/ocorrencias/{id}/acompanhamento";

        foreach (var s in new[] { guardiao, estranho })
        {
            f.Acesso.Limpar();
            var r = await s.Cliente.PutAsJsonAsync(url, new { boNumero = "X", boStatus = "registrado", recuperacao = "recuperado" });
            Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
            var c = Assert.Single(f.Acesso.Chamadas);
            Assert.Equal(("recurso-de-outro-usuario", (Guid?)dono.UsuarioId), (c.Campo, c.UsuarioAlvoId));
        }
        var o = f.NovoDb().Ocorrencias.Single(x => x.Id == id);
        Assert.Equal((null, "nao_registrado", "sem_noticia"), (o.BoNumero, o.BoStatus, o.Recuperacao));
    }

    [Fact]
    public async Task Ponte_nao_recebe_numero_do_bo_nem_recuperacao()
    {
        var dono = await f.NovoUsuarioAsync();
        var id = await OcorrenciaAsync(dono);
        (await dono.Cliente.PutAsJsonAsync($"/api/v1/ocorrencias/{id}/acompanhamento", new { boNumero = "2026/123456", boStatus = "registrado", recuperacao = "recuperado" })).EnsureSuccessStatusCode();
        (await Compartilhar(dono.Cliente, id)).EnsureSuccessStatusCode();

        var e = f.Ponte.Enviadas.Single();
        var json = JsonSerializer.Serialize(e, Ampara.Infrastructure.Ponte.PontePoliciaClient.Json);
        Assert.DoesNotContain("2026/123456", json);
        Assert.DoesNotContain("registrado", json);
        Assert.DoesNotContain("recuperado", json);
        Assert.DoesNotContain(typeof(PonteOcorrencia).GetProperties(), p => System.Text.RegularExpressions.Regex.IsMatch(p.Name, "bo|recuperacao", System.Text.RegularExpressions.RegexOptions.IgnoreCase));
        Assert.Equal(7, JsonDocument.Parse(json).RootElement.EnumerateObject().Count());
    }
}
