using System.Text;
using Ampara.Application.Cyber;
using Ampara.Application.Comum;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Modera o texto livre do relato: primeiro tira toda PII (o texto que sai para a Claude e o que volta aprovado e sempre o limpo),
/// depois pede a classificacao (ABUSIVO ou OK). Sem chave, erro, timeout ou resposta fora do padrao: devolve null (relato aceito
/// sem texto), sem lancar. O texto nunca vai para log nem para mensagem de erro.
/// </summary>
public sealed class ClaudeModeradorRelato(
    IHttpClientFactory http, IConfiguration config, IPiiScanner scanner, ILogger<ClaudeModeradorRelato> log) : IModeradorRelato
{
    public const int MaxCaracteres = 280;
    public const string Marcador = "[dado removido]";
    // Teto de entrada para o scrub nao varrer um texto gigante; o corte final de 280 vem depois do scrub.
    private const int MaxEntrada = 4000;

    public async Task<string?> ModerarTextoAsync(string texto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        var limpo = Cortar(Limpar(texto.Length > MaxEntrada ? texto[..MaxEntrada] : texto));

        // A decisao de barrar (relato-abusivo) fica fora do try: so a falha de infraestrutura cai no fallback.
        string? veredito;
        try
        {
            veredito = await ClassificarAsync(limpo, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            // So o tipo da excecao: a mensagem poderia carregar trechos da requisicao.
            log.LogWarning("Moderador de relato caiu no fallback sem texto: {Tipo}", ex.GetType().Name);
            return null;
        }

        if (veredito is null) return null;
        if (veredito == "ABUSIVO") throw new DominioException("relato-abusivo");
        return veredito == "OK" ? limpo : null;
    }

    /// <summary>Corta em <see cref="MaxCaracteres"/> sem partir um par substituto (emoji). Vem depois do scrub: um CPF cortado no limite nao escapa.</summary>
    private static string Cortar(string t)
    {
        if (t.Length <= MaxCaracteres) return t;
        var n = char.IsHighSurrogate(t[MaxCaracteres - 1]) ? MaxCaracteres - 1 : MaxCaracteres;
        return t[..n];
    }

    /// <summary>Troca cada trecho achado pelos detectores por <see cref="Marcador"/>. O texto sai normalizado.</summary>
    private string Limpar(string texto)
    {
        var norm = Normalizador.Normalizar(texto);
        var sb = new StringBuilder(norm.Length);
        var pos = 0;
        foreach (var d in scanner.Localizar(norm).OrderBy(d => d.Inicio))
        {
            var fim = d.Inicio + d.Tamanho;
            if (fim <= pos) continue;                       // dentro de um trecho ja trocado
            if (d.Inicio > pos) sb.Append(norm, pos, d.Inicio - pos);
            sb.Append(Marcador);
            pos = fim;
        }
        if (pos < norm.Length) sb.Append(norm, pos, norm.Length - pos);
        return sb.ToString();
    }

    private async Task<string?> ClassificarAsync(string limpo, CancellationToken ct)
    {
        // O texto do cidadao nao pode fechar a citacao do prompt e injetar instrucao.
        var citavel = limpo.Replace('«', ' ').Replace('»', ' ');
        var prompt = $"Você modera relatos curtos de segurança urbana feitos por cidadãos. Responda só com uma palavra: ABUSIVO se o texto tiver propaganda ou opinião política, ofensa ou xingamento, ou descrever pessoas (aparência, roupa, cor da pele, características físicas ou nome); caso contrário, responda OK. Texto: «{citavel}»";

        var bruto = await AnthropicMensagens.EnviarAsync(http, config, prompt, 5, null, log, "Moderador de relato", ct);
        if (string.IsNullOrWhiteSpace(bruto)) return null;

        var palavra = new string(bruto.Where(char.IsLetter).ToArray()).ToUpperInvariant();
        if (palavra.StartsWith("ABUSIVO", StringComparison.Ordinal)) return "ABUSIVO";
        if (palavra.StartsWith("OK", StringComparison.Ordinal)) return "OK";
        return null;
    }
}
