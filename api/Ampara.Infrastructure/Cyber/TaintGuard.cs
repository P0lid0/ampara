using System.Security.Claims;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Guard real do taint (Scoped): antes de um dado sair por um sink, troca ou cifra o que for sensível
/// conforme <see cref="PoliticaTaint"/> e deixa um <see cref="EventoSeguranca"/> sem o valor no rastro.
/// Achados vêm do <see cref="ITaintScope"/> (valores vistos na entrada, mesmo sem padrão) e do <see cref="IPiiScanner"/>.
/// </summary>
public sealed class TaintGuard(
    IPiiScanner scanner, ITaintScope escopo, IPiiProtetor protetor, IRastroSeguranca rastro,
    IOptions<CyberOptions> opcoes, IHttpContextAccessor? http = null, ICorrelacao? correlacao = null) : ITaintGuard
{
    public bool Ativo => opcoes.Value.Efetivo;

    private readonly record struct Candidato(int Inicio, int Tamanho, PiiClasse Classe, string Campo, OrigemDado Origem, bool Marcado);

    public ResultadoTaint Sanitizar(string texto, Sink sink, SanitizarOpcoes? o = null)
    {
        if (!Ativo || string.IsNullOrEmpty(texto) || sink == Sink.HttpAutenticada) return new(texto, false, []);
        // Já cifrado pelo protetor: não há o que proteger e a base64 poderia casar um detector por acaso.
        if (sink == Sink.Banco && protetor.EstaCifrado(texto)) return new(texto, false, []);

        var norm = Normalizador.Normalizar(texto);
        var escolhidos = Escolher(Candidatos(norm, o));
        if (escolhidos.Count == 0) return new(texto, false, []);

        var vistos = new HashSet<string>(StringComparer.Ordinal);
        var eventos = new List<EventoSeguranca>();
        var bloqueado = false;
        var trocas = new List<(int Inicio, int Tamanho, string Novo)>();
        var alvo = o?.UsuarioAlvoId ?? escopo.UsuarioAlvoId ?? AlvoDoUsuario();
        var corr = o?.CorrelationId ?? correlacao?.Id ?? "";

        foreach (var c in escolhidos)   // ordem de posição crescente
        {
            var decisao = PoliticaTaint.Para(sink, c.Classe);
            if (decisao is null) continue;
            var valor = norm.Substring(c.Inicio, c.Tamanho);
            var novo = decisao switch
            {
                Decisao.Cifrado => protetor.Cifrar(valor),
                Decisao.Mascarado => protetor.Mascarar(c.Classe, valor),
                _ => $"[BLOQUEADO:{c.Classe}]",
            };
            trocas.Add((c.Inicio, c.Tamanho, novo));
            if (decisao == Decisao.Bloqueado) bloqueado = true;
            if (!vistos.Add(valor)) continue;   // mesmo valor repetido: um evento só
            eventos.Add(EventoSeguranca.Novo(TimeProvider.System.GetUtcNow(), corr, c.Origem, c.Campo, c.Classe, sink, decisao.Value, alvo));
        }
        if (trocas.Count == 0) return new(texto, false, []);

        var saida = norm;
        for (var i = trocas.Count - 1; i >= 0; i--)   // do fim para o começo: as posições anteriores seguem válidas
            saida = saida[..trocas[i].Inicio] + trocas[i].Novo + saida[(trocas[i].Inicio + trocas[i].Tamanho)..];

        foreach (var e in eventos)
        {
            try { rastro.Registrar(e); }
            catch { /* falha do rastro nunca altera o resultado */ }
        }
        return new(saida, bloqueado, eventos);
    }

    private List<Candidato> Candidatos(string norm, SanitizarOpcoes? o)
    {
        var lista = new List<Candidato>();
        foreach (var (campo, origem, classe, valor) in escopo.Encontrar(norm))
            for (var i = norm.IndexOf(valor, StringComparison.Ordinal); i >= 0; i = norm.IndexOf(valor, i + valor.Length, StringComparison.Ordinal))
                lista.Add(new Candidato(i, valor.Length, classe, campo, origem, true));
        var campoScanner = o?.Campo ?? "texto";
        var origemScanner = o?.Origem ?? OrigemDado.Http;
        foreach (var d in scanner.Localizar(norm))
        {
            var fim = Math.Min(norm.Length, d.Inicio + d.Tamanho);
            var ini = Math.Min(d.Inicio, fim);
            if (fim > ini) lista.Add(new Candidato(ini, fim - ini, d.Classe, campoScanner, origemScanner, false));
        }
        return lista;
    }

    /// <summary>Sem sobreposição: vence quem começa antes, depois o mais longo, depois o marcado no escopo (traz campo e origem reais).</summary>
    private static List<Candidato> Escolher(List<Candidato> todos)
    {
        var ordenados = todos.OrderBy(c => c.Inicio).ThenByDescending(c => c.Tamanho).ThenByDescending(c => c.Marcado).ToList();
        var saida = new List<Candidato>();
        var fimAtual = 0;
        foreach (var c in ordenados)
        {
            if (saida.Count > 0 && c.Inicio < fimAtual) continue;
            saida.Add(c);
            fimAtual = c.Inicio + c.Tamanho;
        }
        return saida;
    }

    /// <summary>Dono do dado = usuário logado. O host usa MapInboundClaims=false e o TokenService emite só "sub"; NameIdentifier fica de reserva.</summary>
    private Guid? AlvoDoUsuario()
    {
        var user = http?.HttpContext?.User;
        var id = user?.FindFirst("sub")?.Value ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(id, out var g) ? g : null;
    }
}
