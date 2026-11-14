using System.Text.Json;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cyber;

namespace Ampara.Tests.Cyber;

public class PiiScannerTests
{
    private static PiiScanner Scanner() => new(DetectoresTests.TodosDetectores());
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement.Clone();
    private static KeyValuePair<string, string?> KV(string k, string? v) => new(k, v);

    [Fact] public void Json_aninhado_e_arrays() {   // SINTETICO
        var a = Scanner().EscanearJson(Json("{\"usuario\":{\"contatos\":[{\"telefone\":\"(11) 98765-4321\"},{\"obs\":\"cpf 529.982.247-25\"}]}}"));
        Assert.Contains(a, x => x.Campo == "usuario.contatos[0].telefone" && x.Classe == PiiClasse.Telefone);
        Assert.Contains(a, x => x.Campo == "usuario.contatos[1].obs" && x.Classe == PiiClasse.Cpf); }

    [Fact] public void Exemplo_do_professor_documento_vira_cpf_por_chave() {
        var a = Assert.Single(Scanner().EscanearJson(Json("{\"documento\":\"123.456.789-00\"}")));
        Assert.Equal(PiiClasse.Cpf, a.Classe); Assert.Equal("documento", a.Campo); Assert.True(a.PorChave); }

    [Fact] public void Raiz_array_e_pii_profundo_ate_60_niveis() {   // SINTETICO
        var r = Assert.Single(Scanner().EscanearJson(Json("[\"529.982.247-25\"]")));
        Assert.Equal("[0]", r.Campo);
        var json = string.Concat(Enumerable.Repeat("{\"n\":", 60)) + "\"maria.teste@exemplo.com\"" + new string('}', 60);
        var a = Assert.Single(Scanner().EscanearJson(Json(json)));
        Assert.Equal(PiiClasse.Email, a.Classe);
        Assert.Equal(string.Join(".", Enumerable.Repeat("n", 60)), a.Campo); }

    [Fact] public void Pares_de_form_query_e_header() {   // SINTETICO
        var a = Scanner().EscanearPares(new[]{ KV("senha","abc12345"), KV("authorization","Bearer x.y.z"), KV("x","maria.teste@exemplo.com") });
        Assert.Equal(new[]{PiiClasse.Senha, PiiClasse.Senha, PiiClasse.Email}, a.Select(x => x.Classe)); }

    [Fact] public void Chaves_extras_tratam_chave_como_senha() {
        var a = Assert.Single(Scanner().EscanearPares(new[]{ KV("meuSegredoX","valorqualquer") }, new[]{ Chaves.Normalizar("meuSegredoX") }));
        Assert.Equal(PiiClasse.Senha, a.Classe); Assert.True(a.PorChave); }

    [Fact] public void Numeros_viram_texto_e_literais_e_vazios_sao_ignorados() {   // SINTETICO
        var a = Scanner().EscanearJson(Json("{\"a\":true,\"b\":null,\"c\":\"\",\"d\":false,\"e\":52998224725}"));
        var x = Assert.Single(a); Assert.Equal("e", x.Campo); Assert.Equal(PiiClasse.Cpf, x.Classe); }

    [Fact] public void Texto_livre_devolve_posicao() {   // SINTETICO
        var a = Assert.Single(Scanner().EscanearTexto("meu cpf é 529.982.247-25.")); Assert.Equal("texto", a.Campo);
        Assert.Equal("529.982.247-25", a.Valor);
        var d = Assert.Single(Scanner().Localizar("meu cpf é 529.982.247-25."));
        Assert.Equal(10, d.Inicio); }

    [Fact] public void Escapes_unicode_do_json_sao_decodificados() =>
        Assert.Single(Scanner().EscanearJson(Json("{\"x\":\"\\u0035\\u0032\\u0039.982.247-25\"}")));   // Review Focus 3

    [Fact] public void TaintScope_rastreia_valor_sem_padrao() {
        var s = new TaintScope(); s.Marcar("Zq9!xKp2", OrigemDado.Form, "senha", PiiClasse.Senha); s.Marcar("ab", OrigemDado.Form, "x", PiiClasse.Senha);
        Assert.Single(s.Encontrar("falha ao salvar Zq9!xKp2 no banco")); Assert.Empty(s.Encontrar("tem ab aqui"));
        Assert.Empty(s.Encontrar("falha ao salvar zq9!xkp2 no banco")); }
}
