using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Frases padrao (2 frases cada), usadas sem chave, com falha da API ou com resposta fora do padrao.</summary>
public static class FrasesPadrao
{
    public const string Bloqueado = "Tentaram usar um dado seu em um lugar inseguro, e nosso sistema bloqueou a ação para proteger sua privacidade. Você não precisa fazer nada agora.";
    public const string Protegido = "Guardamos seus dados com proteção, escondendo ou embaralhando o que é sensível. Você não precisa fazer nada.";
    public const string Permitido = "Mostramos um dado seu somente para você, no lugar certo. Nenhuma ação é necessária.";
    public const string AcessoIndevido = "Alguém tentou entrar em uma área sua sem permissão, e nosso sistema barrou a tentativa. Troque seu código de emergência se a tentativa não foi sua.";
    public const string FalhaSistema = "Algo deu errado do nosso lado e a ação não foi concluída. Tente de novo em alguns minutos; seus dados continuam protegidos.";

    public static IReadOnlyList<string> Todas { get; } = [Bloqueado, Protegido, Permitido, AcessoIndevido, FalhaSistema];

    // Recusas de regra (4xx de dominio): dizem o que conferir, nunca "falha do nosso lado, tente em alguns minutos".
    public const string RecusaPadrao = "Não foi possível concluir a ação com as informações enviadas. Confira os dados e tente de novo.";
    public const string CredenciaisInvalidas = "Os dados de acesso não conferem. Confira o e-mail e a senha ou o código e tente entrar de novo.";
    public const string SessaoInvalida = "Sua sessão terminou ou não é mais válida. Entre de novo para continuar.";
    public const string ConviteInvalido = "Código inválido. Confira com quem te convidou.";
    public const string ConviteVencido = "Esse código venceu. Peça outro para quem te convidou.";
    public const string LimiteGuardioes = "O limite de 3 guardiões já foi atingido. Não é possível acrescentar outro agora.";
    public const string EmailJaCadastrado = "Já existe uma conta com esse e-mail. Entre com ele ou use outro endereço.";
    public const string RelatoAbusivo = "Seu relato não foi publicado porque descreve pessoas, tem ofensa ou propaganda. Reescreva falando só do lugar e do que aconteceu.";
    public const string MuitasTentativas = "Você fez muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.";
    public const string EmergenciaBloqueada = "O acesso de emergência foi pausado depois de várias tentativas erradas. Espere alguns minutos e tente de novo.";
    public const string NaoEncontrado = "Não encontramos o que você procurou. Confira as informações e tente de novo.";
    public const string SemPermissao = "Essa informação não está liberada para a sua conta. Volte e escolha um item seu.";

    public static IReadOnlyList<string> Recusas { get; } =
    [
        RecusaPadrao, CredenciaisInvalidas, SessaoInvalida, ConviteInvalido, ConviteVencido, LimiteGuardioes, EmailJaCadastrado,
        RelatoAbusivo, MuitasTentativas, EmergenciaBloqueada, NaoEncontrado, SemPermissao,
    ];

    /// <summary>Frase da recusa pelo codigo do erro de dominio; codigo desconhecido cai na recusa generica.</summary>
    public static string ParaRecusa(string codigo) => codigo switch
    {
        "credenciais-invalidas" => CredenciaisInvalidas,
        "token-invalido" => SessaoInvalida,
        "convite-invalido" => ConviteInvalido,
        "convite-vencido" => ConviteVencido,
        "limite-guardioes" => LimiteGuardioes,
        "email-ja-cadastrado" => EmailJaCadastrado,
        "relato-abusivo" => RelatoAbusivo,
        "limite" or "limite-relatos" => MuitasTentativas,
        "emergencia-bloqueada" => EmergenciaBloqueada,
        _ when codigo.EndsWith("-nao-encontrado", StringComparison.Ordinal) || codigo.EndsWith("-nao-encontrada", StringComparison.Ordinal)
            || codigo.EndsWith("-desconhecida", StringComparison.Ordinal) || codigo.EndsWith("-desconhecido", StringComparison.Ordinal) => NaoEncontrado,
        _ when codigo.Contains("-de-outro-", StringComparison.Ordinal) || codigo == "nao-e-guardiao" => SemPermissao,
        _ => RecusaPadrao,
    };

    /// <summary>Frase padrao do evento: recusa de regra pelo codigo; o resto pelo tipo.</summary>
    public static string Para(EventoTecnico evento) =>
        evento.Tipo == EventoTecnico.Recusado ? ParaRecusa(evento.Categoria) : Para(evento.Tipo);

    public static string Para(string tipo) => tipo switch
    {
        nameof(Decisao.Bloqueado) => Bloqueado,
        nameof(Decisao.Mascarado) or nameof(Decisao.Cifrado) => Protegido,
        nameof(Decisao.Permitido) => Permitido,
        EventoTecnico.AcessoIndevido => AcessoIndevido,
        _ => FalhaSistema,
    };
}

/// <summary>
/// Traduz o evento pela Messages API da Anthropic. So categoria, sink e tipo entram no prompt, e o prompt ainda passa pelo
/// guard (sink Llm). Sem chave, com erro, timeout (5 s no total) ou resposta fora do padrao: frase padrao, sem lancar.
/// </summary>
public sealed class ClaudeTradutorRisco(
    IHttpClientFactory http, IConfiguration config, ITaintGuard guard, IMemoryCache cache, ILogger<ClaudeTradutorRisco> log) : ITradutorRisco
{
    public const string ModeloPadrao = AnthropicMensagens.ModeloPadrao;
    private const string Sistema = "Você escreve avisos curtos e calmos em português do Brasil.";
    private static readonly TimeSpan Validade = TimeSpan.FromHours(1);

    public async Task<string> TraduzirAsync(EventoTecnico evento, CancellationToken ct = default)
    {
        var padrao = FrasesPadrao.Para(evento);
        // Recusa de regra: a frase fixa por codigo ja diz o que conferir; a IA so explicaria uma "falha tecnica" generica e custaria ate 5 s.
        if (evento.Tipo == EventoTecnico.Recusado) return padrao;
        try
        {
            if (AnthropicMensagens.Chave(config) is null) return padrao;

            var prompt = $"Traduza a falha técnica '{evento.Categoria} no {evento.Sink}: {evento.Tipo}' para um cidadão leigo de 60 anos, em 2 frases: a primeira diz o que aconteceu e a segunda diz o que a pessoa deve fazer. Não use termos técnicos e não repita nenhum dado pessoal.";
            var limpo = guard.Sanitizar(prompt, Sink.Llm);
            // Um valor escondido em categoria, sink ou tipo seria trocado ou bloqueado aqui: nada sai.
            if (limpo.Bloqueado || limpo.Texto != prompt) return FrasesPadrao.FalhaSistema;

            var cacheKey = $"{evento.Categoria}|{evento.Sink}|{evento.Tipo}";
            if (cache.TryGetValue(cacheKey, out string? guardada) && guardada is not null) return guardada;

            var texto = (await AnthropicMensagens.EnviarAsync(http, config, limpo.Texto, 200, Sistema, log, "Tradutor de risco", ct))?.Trim();
            if (texto is null || texto.Length is < 20 or > 300) return padrao;

            cache.Set(cacheKey, texto, Validade);
            return texto;
        }
        catch (Exception ex)
        {
            // So o tipo da excecao: a mensagem poderia carregar trechos de requisicao.
            log.LogWarning("Tradutor de risco caiu na frase padrao: {Tipo}", ex.GetType().Name);
            return padrao;
        }
    }
}
