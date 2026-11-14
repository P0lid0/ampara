using System.Text;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Tests.Cyber;

public class CorpusPrecisaoRecallTests
{
    private static readonly PiiClasse[] Classes = Enum.GetValues<PiiClasse>();

    [Fact] public void Corpus_atinge_metas() {
        var raiz = RaizDoRepositorio();
        var r = AvaliarCorpus(Path.Combine(raiz, "cyber", "corpus", "corpus.csv"));
        var md = r.ParaMarkdown();                                  // vai para a evidência mesmo se uma meta falhar
        Directory.CreateDirectory(Path.Combine(raiz, "cyber", "evidencias"));
        File.WriteAllText(Path.Combine(raiz, "cyber", "evidencias", "precisao-recall.md"), md, new UTF8Encoding(false));

        Assert.True(r.Linhas >= 240, $"linhas: {r.Linhas}");
        Assert.All(Classes, c => Assert.True(r.Positivos[c] >= 20, $"positivos {c}: {r.Positivos[c]}"));
        Assert.True(r.Negativos >= 120, $"negativos: {r.Negativos}");
        Assert.True(r.PrecisaoGlobal >= 0.95, $"precisão global {r.PrecisaoGlobal:P1}\n{md}");
        Assert.True(r.RecallGlobal >= 0.90, $"recall global {r.RecallGlobal:P1}\n{md}");
        Assert.All(Classes, c => {
            Assert.True(r.Recall[c] >= 0.85, $"recall {c} {r.Recall[c]:P1}\n{md}");
            Assert.True(r.Precisao[c] >= 0.90, $"precisão {c} {r.Precisao[c]:P1}\n{md}"); }); }

    // ---- avaliação ----------------------------------------------------------------------------------------

    private sealed class Resultado {
        public int Linhas, Negativos;
        public Dictionary<PiiClasse, int> Tp = [], Fp = [], Fn = [], Positivos = [];
        public Dictionary<PiiClasse, double> Precisao = [], Recall = [];
        public double PrecisaoGlobal, RecallGlobal;
        public List<string> Erros = [];

        public string ParaMarkdown() {
            var sb = new StringBuilder();
            sb.AppendLine("# Precisão e recall dos detectores de PII").AppendLine();
            sb.AppendLine("Corpus sintético `cyber/corpus/corpus.csv` (semente 42, gerado por `cyber/corpus/gerar_corpus.py`).");
            sb.AppendLine($"Linhas: {Linhas} ({Linhas - Negativos} positivas, {Negativos} negativas). Cada linha prevê a união das classes");
            sb.AppendLine("achadas pelos detectores no valor normalizado e pelas chaves indicadas no nome do campo.").AppendLine();
            sb.AppendLine("| Classe | Positivos | TP | FP | FN | Precisão | Recall |");
            sb.AppendLine("|---|---:|---:|---:|---:|---:|---:|");
            foreach (var c in Classes)
                sb.AppendLine($"| {c} | {Positivos[c]} | {Tp[c]} | {Fp[c]} | {Fn[c]} | {Precisao[c]:P1} | {Recall[c]:P1} |");
            var tp = Tp.Values.Sum(); var fp = Fp.Values.Sum(); var fn = Fn.Values.Sum();
            sb.AppendLine($"| **Global** | {Positivos.Values.Sum()} | {tp} | {fp} | {fn} | {PrecisaoGlobal:P1} | {RecallGlobal:P1} |");
            sb.AppendLine().AppendLine("Metas: precisão global ≥ 95 %, recall global ≥ 90 %, por classe recall ≥ 85 % e precisão ≥ 90 %.");
            sb.AppendLine().AppendLine("## Limitações conhecidas");
            sb.AppendLine("- O corpus é sintético e foi escrito junto com os detectores: os números medem regressão, não o desempenho em dado real.");
            sb.AppendLine("- Por chave, a regra do plano casa prefixo/sufixo de termos de 3 letras: um campo chamado `cidade` indicaria Saúde (`cid`).");
            sb.AppendLine("- Por valor, 10 dígitos soltos não são telefone (confundiriam com data Unix); com DDD entre parênteses ou `+55` são.");
            sb.AppendLine("- 11 dígitos soltos com 3º dígito 9 e DV de CPF inválido contam como telefone (desempate da spec).");
            if (Erros.Count > 0) {
                sb.AppendLine().AppendLine("## Linhas com erro (id: previsto × esperado)");
                foreach (var e in Erros) sb.AppendLine($"- {e}"); }
            return sb.ToString(); }
    }

    private static Resultado AvaliarCorpus(string caminho) {
        var detectores = DetectoresTests.TodosDetectores();
        var r = new Resultado();
        foreach (var c in Classes) { r.Tp[c] = r.Fp[c] = r.Fn[c] = r.Positivos[c] = 0; }

        var linhas = LerCsv(File.ReadAllText(caminho, Encoding.UTF8));
        Assert.Equal(["id", "chave", "valor", "esperado"], linhas[0]);
        foreach (var l in linhas.Skip(1)) {
            var (id, chave, valor, esperadoTxt) = (l[0], l[1], l[2], l[3]);
            var esperado = esperadoTxt.Length == 0
                ? new HashSet<PiiClasse>()
                : esperadoTxt.Split('|').Select(Enum.Parse<PiiClasse>).ToHashSet();
            var texto = Normalizador.Normalizar(valor);
            var chaveN = Chaves.Normalizar(chave);
            var previsto = detectores.Where(d => d.Detectar(texto).Count > 0 || d.ChaveIndica(chaveN))
                .Select(d => d.Classe).ToHashSet();

            r.Linhas++;
            if (esperado.Count == 0) r.Negativos++;
            foreach (var c in Classes) {
                var e = esperado.Contains(c); var p = previsto.Contains(c);
                if (e) r.Positivos[c]++;
                if (e && p) r.Tp[c]++; else if (p) r.Fp[c]++; else if (e) r.Fn[c]++; }
            if (!previsto.SetEquals(esperado))
                r.Erros.Add($"{id}: previsto [{string.Join("|", previsto)}] × esperado [{esperadoTxt}] (chave `{chave}`)"); }

        foreach (var c in Classes) {
            r.Precisao[c] = r.Tp[c] + r.Fp[c] == 0 ? 1 : (double)r.Tp[c] / (r.Tp[c] + r.Fp[c]);
            r.Recall[c] = r.Tp[c] + r.Fn[c] == 0 ? 1 : (double)r.Tp[c] / (r.Tp[c] + r.Fn[c]); }
        double tp = r.Tp.Values.Sum(), fp = r.Fp.Values.Sum(), fn = r.Fn.Values.Sum();
        r.PrecisaoGlobal = tp + fp == 0 ? 1 : tp / (tp + fp);
        r.RecallGlobal = tp + fn == 0 ? 1 : tp / (tp + fn);
        return r; }

    /// <summary>CSV (RFC 4180): campos entre aspas podem ter vírgula e aspas duplicadas.</summary>
    private static List<string[]> LerCsv(string texto) {
        var linhas = new List<string[]>(); var campos = new List<string>(); var sb = new StringBuilder();
        var aspas = false;
        for (var i = 0; i < texto.Length; i++) {
            var ch = texto[i];
            if (aspas) {
                if (ch == '"' && i + 1 < texto.Length && texto[i + 1] == '"') { sb.Append('"'); i++; }
                else if (ch == '"') aspas = false;
                else sb.Append(ch); }
            else if (ch == '"') aspas = true;
            else if (ch == ',') { campos.Add(sb.ToString()); sb.Clear(); }
            else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < texto.Length && texto[i + 1] == '\n') i++;
                campos.Add(sb.ToString()); sb.Clear(); linhas.Add([.. campos]); campos.Clear(); }
            else sb.Append(ch); }
        if (sb.Length > 0 || campos.Count > 0) { campos.Add(sb.ToString()); linhas.Add([.. campos]); }
        return linhas; }

    private static string RaizDoRepositorio() {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d is not null && !(Directory.Exists(Path.Combine(d.FullName, "cyber")) && Directory.Exists(Path.Combine(d.FullName, "api"))))
            d = d.Parent;
        Assert.NotNull(d);
        return d.FullName; }
}
