using System.Net;
using System.Security.Claims;
using System.Text;
using Ampara.Domain.Cyber;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Ampara.Tests.Cyber;

public class RespostaNaoAutenticadaTests
{
    // Todos os dados abaixo são sintéticos.
    private const string JwtFalso = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Mjk5ODIyNDcyNSJ9.c2lnMTIzNDU2Nzg5MDE";

    private static void Mapa(IEndpointRouteBuilder m)
    {
        m.MapGet("/vaza-cpf", () => Results.Json(new { cpf = "529.982.247-25" }));
        m.MapGet("/vaza-senha", () => Results.Json(new { senha = "abc12345" }));
        m.MapGet("/autenticado", (HttpContext c) =>
        {
            c.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "teste"));
            return Results.Json(new { cpf = "529.982.247-25" });
        });
        m.MapPost("/binding", (Corpo c) => Results.Ok(c));
        m.MapGet("/eco-400", () => Results.BadRequest(new { erro = "valor invalido: 529.982.247-25" }));
        m.MapGet("/catalogo", () => Results.Json(new { telefone = "(11) 4004-0000" }))
            .WithMetadata(new PiiPermitidaAttribute(PiiClasse.Telefone));
        m.MapGet("/catalogo-cpf", () => Results.Json(new { telefone = "(11) 4004-0000", cpf = "529.982.247-25" }))
            .WithMetadata(new PiiPermitidaAttribute(PiiClasse.Telefone));
        m.MapPost("/login", () => Results.Json(new
        {
            token = JwtFalso, expiraEm = "2026-11-14T12:00:00Z", usuarioId = "3f2b8c1e-5a4d-4e0b-9c7a-1d2e3f4a5b6c", lat = -23.5672490,
        }));
        m.MapGet("/imagem", async (HttpContext c) =>
        {
            c.Response.ContentType = "image/png";
            await c.Response.Body.WriteAsync(Encoding.UTF8.GetBytes("529.982.247-25"));
        });
        m.MapGet("/hubs/x/negotiate", () => Results.Json(new { cpf = "529.982.247-25" }));
        m.MapGet("/grande", () => Results.Text(new string('a', 500), "text/plain"));
    }

    private sealed record Corpo(Guid Id);

    private static async Task<(HttpResponseMessage R, string Corpo, CyberTestHost H)> Get(string rota, Dictionary<string, string?>? cfg = null, HttpMethod? metodo = null, HttpContent? conteudo = null)
    {
        var h = await CyberTestHost.IniciarAsync(Mapa, config: cfg);
        var r = await h.GetTestClient().SendAsync(new HttpRequestMessage(metodo ?? HttpMethod.Get, rota) { Content = conteudo });
        return (r, await r.Content.ReadAsStringAsync(), h);
    }

    [Fact] public async Task Resposta_com_cpf_e_bloqueada_com_frase_da_ia()
    {
        var (r, t, h) = await Get("/vaza-cpf");
        await using var _ = h;
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType!.MediaType);
        Assert.DoesNotContain("529.982.247-25", t);
        Assert.Contains("detalheCidadao", t);
        Assert.Contains("urn:ampara:taint:bloqueado", t);
        var e = Assert.Single(h.Rastro.Eventos);
        Assert.Equal((Sink.HttpNaoAutenticada, Decisao.Bloqueado), (e.Sink, e.Decisao));
    }

    [Fact] public async Task Senha_na_resposta_e_bloqueada_por_chave()
    {
        var (r, t, h) = await Get("/vaza-senha");
        await using var _ = h;
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType!.MediaType);
        Assert.DoesNotContain("abc12345", t);
        Assert.Equal((Sink.HttpNaoAutenticada, Decisao.Bloqueado, PiiClasse.Senha), (h.Rastro.Eventos[0].Sink, h.Rastro.Eventos[0].Decisao, h.Rastro.Eventos[0].Classe));
    }

    [Fact] public async Task Resposta_autenticada_passa()
    {
        var (r, t, h) = await Get("/autenticado");
        await using var _ = h;
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("529.982.247-25", t);
        Assert.Empty(h.Rastro.Eventos);
    }

    [Fact] public async Task Erro_400_do_binding_que_ecoa_o_valor_e_bloqueado_mantendo_400()
    {
        // Binding real: o corpo é inválido para Guid.
        var (r, t, h) = await Get("/binding", metodo: HttpMethod.Post,
            conteudo: new StringContent("{\"id\":\"529.982.247-25\"}", Encoding.UTF8, "application/json"));
        await using var _ = h;
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.DoesNotContain("529.982.247-25", t);

        // Endpoint que ecoa o valor no 400: bloqueado e o status 4xx original é mantido.
        var (r2, t2, h2) = await Get("/eco-400");
        await using var _2 = h2;
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);
        Assert.Equal("application/problem+json", r2.Content.Headers.ContentType!.MediaType);
        Assert.DoesNotContain("529.982.247-25", t2);
        Assert.Contains("urn:ampara:taint:bloqueado", t2);
    }

    [Fact] public async Task Catalogo_com_telefone_passa()
    {
        var (r, t, h) = await Get("/catalogo");
        await using var _ = h;
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("(11) 4004-0000", t);
        var e = Assert.Single(h.Rastro.Eventos);
        Assert.Equal((Decisao.Permitido, Sink.HttpNaoAutenticada), (e.Decisao, e.Sink));
        Assert.Equal(PiiClasse.Telefone, e.Classe);
    }

    [Fact] public async Task Catalogo_com_cpf_continua_bloqueado()
    {
        var (r, t, h) = await Get("/catalogo-cpf");
        await using var _ = h;
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.DoesNotContain("529.982.247-25", t);
        Assert.DoesNotContain("4004-0000", t);
        Assert.All(h.Rastro.Eventos, e => Assert.Equal(PiiClasse.Cpf, e.Classe));
    }

    [Fact] public async Task Login_com_jwt_passa()
    {
        var (r, t, h) = await Get("/login", metodo: HttpMethod.Post);
        await using var _ = h;
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains(JwtFalso, t);
        Assert.Contains("-23.567249", t);   // o serializador descarta o zero final
        Assert.Empty(h.Rastro.Eventos);
    }

    [Fact] public async Task Binario_e_hubs_sao_ignorados_e_corpo_gigante_e_bloqueado()
    {
        var (r1, t1, h1) = await Get("/imagem");
        await using var _1 = h1;
        Assert.Equal(HttpStatusCode.OK, r1.StatusCode);
        Assert.Equal("529.982.247-25", t1);

        var (r2, t2, h2) = await Get("/hubs/x/negotiate");
        await using var _2 = h2;
        Assert.Equal(HttpStatusCode.OK, r2.StatusCode);
        Assert.Contains("529.982.247-25", t2);

        // limite 100 bytes: o corpo de 500 bytes passa de 4x? Não (400), então com 500 > 400 é bloqueado.
        var (r3, t3, h3) = await Get("/grande", new() { ["Cyber:LimiteCorpoBytes"] = "100" });
        await using var _3 = h3;
        Assert.Equal(HttpStatusCode.InternalServerError, r3.StatusCode);
        Assert.Equal("application/problem+json", r3.Content.Headers.ContentType!.MediaType);
        Assert.DoesNotContain("aaaa", t3);

        // dentro do limite (4 x 1 MiB), o mesmo corpo passa.
        var (r4, t4, h4) = await Get("/grande");
        await using var _4 = h4;
        Assert.Equal(HttpStatusCode.OK, r4.StatusCode);
        Assert.Equal(500, t4.Length);
    }
}
