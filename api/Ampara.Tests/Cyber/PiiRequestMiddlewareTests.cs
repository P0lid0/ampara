using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Ampara.Tests.Cyber;

public class PiiRequestMiddlewareTests
{
    // Todos os dados abaixo são sintéticos.
    [Fact] public async Task Json_marca_documento_e_o_endpoint_ainda_le_o_corpo() {
        await using var h = await CyberTestHost.IniciarAsync(m => m.MapPost("/eco", async (HttpContext c, ITaintScope s) => {
            var corpo = await new StreamReader(c.Request.Body).ReadToEndAsync();
            return Results.Ok(new { corpo, marcados = s.Encontrar("123.456.789-00").Count }); }));
        var r = await h.GetTestClient().PostAsJsonAsync("/eco", new { documento = "123.456.789-00", nome = "x" });
        var o = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("123.456.789-00", o.GetProperty("corpo").GetString());
        Assert.Equal(1, o.GetProperty("marcados").GetInt32()); }

    [Fact] public async Task Form_query_e_header_sao_marcados_com_a_origem_certa() {
        await using var h = await CyberTestHost.IniciarAsync(m => m.MapPost("/eco", async (HttpContext c, ITaintScope s) => {
            var form = await c.Request.ReadFormAsync();
            return Results.Ok(new {
                cpf = form["cpf"].ToString(),
                form = s.Encontrar("529.982.247-25").Select(x => new { origem = x.Origem.ToString(), x.Campo }),
                query = s.Encontrar("(11) 98765-4321").Select(x => x.Origem.ToString()),
                header = s.Encontrar("maria@exemplo.com").Select(x => x.Origem.ToString()),
                auth = s.Encontrar("Bearer abc123def456").Select(x => new { origem = x.Origem.ToString(), classe = x.Classe.ToString() }),
            }); }));
        var req = new HttpRequestMessage(HttpMethod.Post, "/eco?telefone=" + Uri.EscapeDataString("(11) 98765-4321"))
        { Content = new FormUrlEncodedContent([new("cpf", "529.982.247-25")]) };
        req.Headers.Add("X-Teste", "maria@exemplo.com");
        req.Headers.Add("Authorization", "Bearer abc123def456");
        var o = await (await h.GetTestClient().SendAsync(req)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("529.982.247-25", o.GetProperty("cpf").GetString());   // o endpoint ainda lê o form
        Assert.Equal("Form", o.GetProperty("form")[0].GetProperty("origem").GetString());
        Assert.Equal("cpf", o.GetProperty("form")[0].GetProperty("campo").GetString());
        Assert.Equal("Query", o.GetProperty("query")[0].GetString());
        Assert.Equal("Header", o.GetProperty("header")[0].GetString());
        Assert.Equal("Header", o.GetProperty("auth")[0].GetProperty("origem").GetString());
        Assert.Equal("Senha", o.GetProperty("auth")[0].GetProperty("classe").GetString()); }

    [Fact] public async Task Multipart_le_campo_mas_nao_o_arquivo() {
        await using var h = await CyberTestHost.IniciarAsync(m => m.MapPost("/up", async (HttpContext c, ITaintScope s) => {
            var form = await c.Request.ReadFormAsync();
            var arq = form.Files["anexo"]!;
            using var leitor = new StreamReader(arq.OpenReadStream());
            var conteudo = await leitor.ReadToEndAsync();
            return Results.Ok(new {
                conteudo,
                senha = s.Encontrar("abc12345").Select(x => new { origem = x.Origem.ToString(), classe = x.Classe.ToString() }),
                cpfDoArquivo = s.Encontrar("529.982.247-25").Count,
            }); }));
        using var mp = new MultipartFormDataContent
        {
            { new StringContent("abc12345"), "senha" },
            { new StringContent("cpf 529.982.247-25 no arquivo", Encoding.UTF8, "text/plain"), "anexo", "nota.txt" },
        };
        var o = await (await h.GetTestClient().PostAsync("/up", mp)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Form", o.GetProperty("senha")[0].GetProperty("origem").GetString());
        Assert.Equal("Senha", o.GetProperty("senha")[0].GetProperty("classe").GetString());
        Assert.Equal(0, o.GetProperty("cpfDoArquivo").GetInt32());
        Assert.Equal("cpf 529.982.247-25 no arquivo", o.GetProperty("conteudo").GetString()); }

    [Fact] public async Task Codigo_de_emergencia_so_e_senha_nas_rotas_configuradas() {
        await using var h = await CyberTestHost.IniciarAsync(m => {
            m.MapPost("/api/v1/auth/emergencia", (ITaintScope s) => Results.Ok(s.Encontrar("481516").Select(x => x.Classe.ToString())));
            m.MapPost("/api/v1/guardioes/convites/{c}/aceitar", (ITaintScope s) => Results.Ok(s.Encontrar("481516").Select(x => x.Classe.ToString()))); });
        var cli = h.GetTestClient();
        var a = await (await cli.PostAsJsonAsync("/api/v1/auth/emergencia", new { codigo = "481516" })).Content.ReadFromJsonAsync<string[]>();
        var b = await (await cli.PostAsJsonAsync("/api/v1/guardioes/convites/ABC123/aceitar", new { codigo = "481516" })).Content.ReadFromJsonAsync<string[]>();
        Assert.Equal(["Senha"], a!);
        Assert.Empty(b!); }

    [Fact] public async Task Cadastro_chega_intacto_ao_endpoint() {
        await using var h = await CyberTestHost.IniciarAsync(m => m.MapPost("/api/v1/auth/registrar", async (HttpContext c, ITaintScope s) => {
            var d = await c.Request.ReadFromJsonAsync<JsonElement>();
            return Results.Ok(new {
                nome = d.GetProperty("nome").GetString(), email = d.GetProperty("email").GetString(), senha = d.GetProperty("senha").GetString(),
                senhaMarcada = s.Encontrar("Segredo#Falso9").Any(x => x.Classe == PiiClasse.Senha),
            }); }));
        var r = await h.GetTestClient().PostAsJsonAsync("/api/v1/auth/registrar", new { nome = "Maria Teste", email = "maria.teste@exemplo.com", senha = "Segredo#Falso9" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var o = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Maria Teste", o.GetProperty("nome").GetString());
        Assert.Equal("maria.teste@exemplo.com", o.GetProperty("email").GetString());
        Assert.Equal("Segredo#Falso9", o.GetProperty("senha").GetString());
        Assert.True(o.GetProperty("senhaMarcada").GetBoolean()); }

    [Fact] public async Task Entrada_hostil_nao_derruba() {
        await using var h = await CyberTestHost.IniciarAsync(m => m.MapPost("/eco", async (HttpContext c) =>
            { var corpo = await new StreamReader(c.Request.Body).ReadToEndAsync(); return Results.Ok(new { corpo }); }));
        var cli = h.GetTestClient();

        var grande = new StringContent(new string('a', 1_048_576 + 1), Encoding.UTF8, "application/json");
        var r1 = await cli.PostAsync("/eco", grande);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, r1.StatusCode);
        Assert.Equal("application/problem+json", r1.Content.Headers.ContentType?.MediaType);

        var limite = new StringContent("\"" + new string('a', 1_048_576 - 2) + "\"", Encoding.UTF8, "application/json");
        Assert.Equal(HttpStatusCode.OK, (await cli.PostAsync("/eco", limite)).StatusCode);

        var fundo = string.Concat(Enumerable.Repeat("[", 65)) + string.Concat(Enumerable.Repeat("]", 65));
        var r2 = await cli.PostAsync("/eco", new StringContent(fundo, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);
        Assert.Equal("application/problem+json", r2.Content.Headers.ContentType?.MediaType);

        var ok64 = string.Concat(Enumerable.Repeat("[", 64)) + string.Concat(Enumerable.Repeat("]", 64));
        Assert.Equal(HttpStatusCode.OK, (await cli.PostAsync("/eco", new StringContent(ok64, Encoding.UTF8, "application/json"))).StatusCode);

        var r3 = await cli.PostAsync("/eco", new StringContent("{nao é json", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, r3.StatusCode);
        Assert.Contains("{nao é json", (await r3.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("corpo").GetString());

        var semTipo = new HttpRequestMessage(HttpMethod.Post, "/eco") { Content = new ByteArrayContent("xyz"u8.ToArray()) };
        Assert.Equal(HttpStatusCode.OK, (await cli.SendAsync(semTipo)).StatusCode); }

    [Fact] public async Task Correlation_id_valido_e_reaproveitado_invalido_e_trocado() {
        await using var h = await CyberTestHost.IniciarAsync(m => m.MapGet("/id", (ICorrelacao c) => Results.Ok(new { c.Id })));
        var cli = h.GetTestClient();

        async Task<(string cab, string corpo)> Chamar(string id) {
            var req = new HttpRequestMessage(HttpMethod.Get, "/id");
            req.Headers.TryAddWithoutValidation("X-Correlation-Id", id);
            var r = await cli.SendAsync(req);
            return (r.Headers.GetValues("X-Correlation-Id").Single(), (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!);
        }

        var (cab, corpo) = await Chamar("abc-123");
        Assert.Equal("abc-123", cab); Assert.Equal("abc-123", corpo);
        foreach (var ruim in new[] { "a\r\nb", new string('a', 65), "a b", "a.b" })
        {
            try
            {
                var (c2, b2) = await Chamar(ruim);
                Assert.True(Guid.TryParse(c2, out _)); Assert.Equal(c2, b2);
            }
            catch (FormatException) { /* o cliente nem aceita montar o cabeçalho com quebra de linha */ }
        } }

    [Fact] public async Task Demo_com_taint_desligado_nao_marca_mas_fora_da_demo_o_desligar_e_ignorado() {
        async Task<int> Marcados(Dictionary<string, string?> cfg) {
            await using var h = await CyberTestHost.IniciarAsync(
                m => m.MapPost("/eco", (ITaintScope s) => Results.Ok(s.Encontrar("123.456.789-00").Count)), config: cfg);
            var r = await h.GetTestClient().PostAsJsonAsync("/eco", new { documento = "123.456.789-00" });
            return await r.Content.ReadFromJsonAsync<int>(); }
        Assert.Equal(0, await Marcados(new() { ["AMPARA_DEMO"] = "true", ["Cyber:TaintAtivo"] = "false" }));
        Assert.Equal(1, await Marcados(new() { ["Cyber:TaintAtivo"] = "false" })); }
}
