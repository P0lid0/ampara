using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Dados;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Tests.Cyber;

public class SegurancaApiTests(CyberApiFactory f) : IClassFixture<CyberApiFactory>
{
    private Task<UsuarioCyber> Usuario() => CyberTestHelpers.CriarUsuarioAsync(f.CreateClient());

    private async Task<HttpClient> Admin()
    {
        var c = f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { email = DemoSeeder.EmailAdmin, senha = DemoSeeder.SenhaDemo });
        r.EnsureSuccessStatusCode();
        var token = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return c;
    }

    /// <summary>Grava direto no repositório; cada item vira N eventos de há alguns minutos.</summary>
    private async Task Semear(UsuarioCyber u, params (Sink Sink, Decisao Decisao, int N)[] itens)
    {
        foreach (var (sink, decisao, n) in itens)
            for (var i = 0; i < n; i++)
                await Gravar(u.UsuarioId, PiiClasse.Cpf, sink, decisao, DateTimeOffset.UtcNow.AddMinutes(-i - 1));
    }

    private async Task Gravar(Guid? alvo, PiiClasse classe, Sink sink, Decisao decisao, DateTimeOffset em)
    {
        using var escopo = f.Services.CreateScope();
        await escopo.ServiceProvider.GetRequiredService<IEventoSegurancaRepository>().AdicionarAsync(
            EventoSeguranca.Novo(em, "cid-teste", OrigemDado.Http, "campo", classe, sink, decisao, alvo));
    }

    private static async Task<(string Farol, int Indice)> Estado(UsuarioCyber u)
    {
        var r = await u.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/seguranca/meu-risco");
        return (r.GetProperty("farol").GetString()!, r.GetProperty("indice").GetInt32());
    }

    private static async Task Simular(UsuarioCyber u, string cenario)
    {
        var r = await u.Cliente.PostAsJsonAsync("/api/v1/seguranca/simular-ataque", new { cenario });
        Assert.Equal(HttpStatusCode.Accepted, r.StatusCode);
    }

    [Fact] public async Task Meu_risco_soma_pesos_e_define_farol()
    {
        var u = await Usuario(); await Semear(u, (Sink.Log, Decisao.Bloqueado, 3));   // 3 Log bloqueados = 30
        var r = await u.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/seguranca/meu-risco");
        Assert.Equal(30, r.GetProperty("indice").GetInt32()); Assert.Equal("amarelo", r.GetProperty("farol").GetString());
        Assert.Equal(3, r.GetProperty("eventos").GetArrayLength());
        Assert.All(r.GetProperty("eventos").EnumerateArray(), e => Assert.False(string.IsNullOrWhiteSpace(e.GetProperty("mensagemCidadao").GetString())));
        Assert.All(r.GetProperty("eventos").EnumerateArray(), e => Assert.False(e.TryGetProperty("usuarioAlvoId", out _)));
    }

    [Fact] public async Task Meu_risco_so_mostra_eventos_do_proprio_usuario_e_exige_jwt()
    {
        var a = await Usuario(); var b = await Usuario();
        await Semear(b, (Sink.Log, Decisao.Bloqueado, 2));
        var r = await a.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/seguranca/meu-risco");
        Assert.Equal(0, r.GetProperty("eventos").GetArrayLength()); Assert.Equal("verde", r.GetProperty("farol").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/seguranca/meu-risco")).StatusCode);
    }

    [Fact] public async Task Meu_risco_ignora_eventos_de_mais_de_24h_e_limita_a_50_mais_recentes_primeiro()
    {
        var u = await Usuario();
        await Gravar(u.UsuarioId, PiiClasse.Cpf, Sink.Log, Decisao.Bloqueado, DateTimeOffset.UtcNow.AddHours(-25));
        await Semear(u, (Sink.Log, Decisao.Mascarado, 55));
        var r = await u.Cliente.GetFromJsonAsync<JsonElement>("/api/v1/seguranca/meu-risco");
        var ev = r.GetProperty("eventos").EnumerateArray().Select(e => e.GetProperty("em").GetDateTimeOffset()).ToList();
        Assert.Equal(50, ev.Count);
        Assert.Equal(ev.OrderByDescending(x => x), ev);
        Assert.Equal(0, r.GetProperty("indice").GetInt32());
    }

    [Fact] public async Task Executivo_exige_admin_e_agrega()
    {
        // O repositório é compartilhado entre os testes da classe: o agregado é conferido por diferença.
        var admin = await Admin();
        var antes = await admin.GetFromJsonAsync<JsonElement>("/api/v1/seguranca/executivo");

        var u = await Usuario();
        for (var i = 0; i < 3; i++) await Gravar(u.UsuarioId, PiiClasse.Cpf, Sink.Log, Decisao.Bloqueado, DateTimeOffset.UtcNow.AddMinutes(-1));
        await Gravar(u.UsuarioId, PiiClasse.Senha, Sink.HttpNaoAutenticada, Decisao.Bloqueado, DateTimeOffset.UtcNow.AddMinutes(-1));
        await Gravar(u.UsuarioId, PiiClasse.Cpf, Sink.Log, Decisao.Bloqueado, DateTimeOffset.UtcNow.AddHours(-25));
        await Gravar(u.UsuarioId, PiiClasse.Imei, Sink.HttpAutenticada, Decisao.Permitido, DateTimeOffset.UtcNow.AddMinutes(-1));

        Assert.Equal(HttpStatusCode.Unauthorized, (await f.CreateClient().GetAsync("/api/v1/seguranca/executivo")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await u.Cliente.GetAsync("/api/v1/seguranca/executivo")).StatusCode);

        var d = await admin.GetFromJsonAsync<JsonElement>("/api/v1/seguranca/executivo");
        int Dif(string grupo, string chave) => d.GetProperty(grupo).GetProperty(chave).GetInt32() - antes.GetProperty(grupo).GetProperty(chave).GetInt32();
        Assert.Equal(4, d.GetProperty("total24h").GetInt32() - antes.GetProperty("total24h").GetInt32());
        Assert.Equal(3, Dif("porClasse", "Cpf")); Assert.Equal(1, Dif("porClasse", "Senha")); Assert.Equal(0, Dif("porClasse", "Imei"));
        Assert.Equal(3, Dif("porSink", "Log")); Assert.Equal(1, Dif("porSink", "HttpNaoAutenticada")); Assert.Equal(0, Dif("porSink", "HttpAutenticada"));
        Assert.Equal(8, d.GetProperty("porClasse").EnumerateObject().Count());
        Assert.Equal(8, d.GetProperty("porSink").EnumerateObject().Count());
        var horas = d.GetProperty("porHora").EnumerateArray().Select(x => x.GetInt32()).ToList();
        Assert.Equal(24, horas.Count);
        Assert.Equal(d.GetProperty("total24h").GetInt32(), horas.Sum());
        Assert.Equal(4, horas[23] - antes.GetProperty("porHora")[23].GetInt32());   // todos de há 1 min
    }

    [Fact] public async Task Simular_ataque_move_o_farol_como_na_demonstracao()
    {
        var u = await Usuario();
        await Simular(u, "acesso-indevido");  Assert.Equal(("amarelo", 40), await Estado(u));
        await Simular(u, "senha-na-resposta"); Assert.Equal(("amarelo", 65), await Estado(u));
        await Simular(u, "cpf-no-log");        Assert.Equal(("vermelho", 75), await Estado(u));
        await Simular(u, "laudo-no-erro");     Assert.Equal(("vermelho", 85), await Estado(u));   // Erro/Bloqueado vale 10: 75 + 10
        var eventos = await f.EventosNoBancoAsync(u.UsuarioId);
        Assert.Contains(eventos, e => e is { Sink: Sink.Log, Decisao: Decisao.Bloqueado, Classe: PiiClasse.Cpf });
        Assert.Contains(eventos, e => e is { Sink: Sink.Erro, Decisao: Decisao.Bloqueado, Classe: PiiClasse.Saude });
    }

    [Fact] public async Task Simular_ataque_so_com_demo_ligado_e_cenario_valido()
    {
        var u = await Usuario();
        Assert.Equal((HttpStatusCode)422, (await u.Cliente.PostAsJsonAsync("/api/v1/seguranca/simular-ataque", new { cenario = "xyz" })).StatusCode);
        Assert.Equal((HttpStatusCode)422, (await u.Cliente.PostAsJsonAsync("/api/v1/seguranca/simular-ataque", new { })).StatusCode);

        using var semDemo = f.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, cfg) =>
            cfg.AddInMemoryCollection(new Dictionary<string, string?> { ["AMPARA_DEMO"] = "false" })));
        var r = await semDemo.CreateClient().PostAsJsonAsync("/api/v1/seguranca/simular-ataque", new { cenario = "cpf-no-log" });
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact] public async Task Resposta_de_meu_risco_nao_contem_valor_de_pii()
    {
        var u = await Usuario();
        foreach (var c in new[] { "cpf-no-log", "senha-na-resposta", "laudo-no-erro", "acesso-indevido" }) await Simular(u, c);
        var texto = await (await u.Cliente.GetAsync("/api/v1/seguranca/meu-risco")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("529.982.247-25", texto); Assert.DoesNotContain("52998224725", texto);
        Assert.DoesNotContain("Sintetica!2026", texto);
        Assert.DoesNotContain("laudo medico", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(u.UsuarioId.ToString(), texto);
    }
}
