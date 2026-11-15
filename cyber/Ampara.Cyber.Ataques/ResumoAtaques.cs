using System.Text;

namespace Ampara.Cyber.Ataques;

/// <summary>
/// Fixture da classe de ataques: cada ataque registra uma linha (id, vetor, esperado, resultado) e, ao fim da execução,
/// a tabela é gravada em <c>cyber/evidencias/ataques.md</c> (usada no PDF). Uma execução parcial (filtro) só troca as
/// linhas dos ataques que rodaram; as demais ficam como estavam.
/// </summary>
public sealed class ResumoAtaques : IDisposable
{
    private readonly object _trava = new();
    private readonly SortedDictionary<string, string> _linhas = new(StringComparer.Ordinal);

    public async Task RodarAsync(string id, string vetor, string esperado, Func<Task<string>> ataque)
    {
        try
        {
            var observado = await ataque();
            Anotar(id, vetor, esperado, "OK: " + observado);
        }
        catch (Exception ex)
        {
            Anotar(id, vetor, esperado, "FALHOU: " + ex.GetType().Name);
            throw;
        }
    }

    private void Anotar(string id, string vetor, string esperado, string resultado)
    {
        lock (_trava) _linhas[id] = $"| {id} | {Celula(vetor)} | {Celula(esperado)} | {Celula(resultado)} |";
    }

    private static string Celula(string t) => t.Replace("|", "\\|").Replace("\r", " ").Replace("\n", " ");

    public void Dispose()
    {
        try
        {
            var caminho = CaminhoDoArquivo();
            if (caminho is null) return;
            var todas = new SortedDictionary<string, string>(StringComparer.Ordinal);
            if (File.Exists(caminho))
                foreach (var l in File.ReadAllLines(caminho))
                    if (l.StartsWith("| A", StringComparison.Ordinal)) todas[l.Split('|')[1].Trim()] = l;
            lock (_trava) foreach (var (id, linha) in _linhas) todas[id] = linha;

            var sb = new StringBuilder();
            sb.Append("# Ataques automatizados (suite Ampara.Cyber.Ataques)\n\n");
            sb.Append("Cada linha e um ataque contra a API real (so banco, Claude e rede sao falsos). Valores sinteticos.\n");
            sb.Append("Este arquivo e regravado a cada execucao de `dotnet test cyber/Ampara.Cyber.Ataques`.\n\n");
            sb.Append("| id | vetor | esperado | resultado |\n|---|---|---|---|\n");
            foreach (var l in todas.Values) sb.Append(l).Append('\n');
            File.WriteAllText(caminho, sb.ToString(), new UTF8Encoding(false));
        }
        catch { /* a evidencia e um extra: nunca derruba a suite */ }
    }

    // Sobe a partir da pasta do binario ate achar a raiz do repositorio (a que tem api/Ampara.sln).
    private static string? CaminhoDoArquivo()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null; d = d.Parent)
            if (File.Exists(Path.Combine(d.FullName, "api", "Ampara.sln")))
                return Path.Combine(d.FullName, "cyber", "evidencias", "ataques.md");
        return null;
    }
}
