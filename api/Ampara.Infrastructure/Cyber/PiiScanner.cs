using System.Text.Json;
using System.Text.RegularExpressions;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

public sealed class PiiScanner : IPiiScanner
{
    private readonly IPiiDetector[] _detectores;

    public PiiScanner(IEnumerable<IPiiDetector> detectores) => _detectores = detectores.ToArray();

    public IReadOnlyList<AchadoPii> EscanearJson(JsonElement raiz)
    {
        var achados = new List<AchadoPii>();
        var pilha = new Stack<(JsonElement No, string Caminho, string Chave)>();
        pilha.Push((raiz, "", ""));

        while (pilha.Count > 0)
        {
            var (no, caminho, chave) = pilha.Pop();
            switch (no.ValueKind)
            {
                case JsonValueKind.Object:
                    // empilha ao contrário para visitar na ordem do documento
                    var props = no.EnumerateObject().ToList();
                    for (var i = props.Count - 1; i >= 0; i--)
                    {
                        var nome = props[i].Name;
                        pilha.Push((props[i].Value, caminho.Length == 0 ? nome : caminho + "." + nome, Chaves.Normalizar(nome)));
                    }
                    break;
                case JsonValueKind.Array:
                    var itens = no.EnumerateArray().ToList();
                    for (var i = itens.Count - 1; i >= 0; i--)
                        pilha.Push((itens[i], caminho + "[" + i + "]", chave));   // elementos herdam a chave do array
                    break;
                case JsonValueKind.String:
                    Valor(no.GetString(), caminho, chave, null, achados);
                    break;
                case JsonValueKind.Number:
                    Valor(no.GetRawText(), caminho, chave, null, achados);
                    break;
                // true, false, null: ignorados
            }
        }
        return achados;
    }

    public IReadOnlyList<AchadoPii> EscanearPares(IEnumerable<KeyValuePair<string, string?>> pares, IReadOnlyCollection<string>? chavesExtras = null)
    {
        var achados = new List<AchadoPii>();
        foreach (var par in pares)
            Valor(par.Value, par.Key, Chaves.Normalizar(par.Key), chavesExtras, achados);
        return achados;
    }

    public IReadOnlyList<AchadoPii> EscanearTexto(string texto, string campo = "texto")
    {
        var achados = new List<AchadoPii>();
        Valor(texto, campo, "", null, achados);
        return achados;
    }

    public IReadOnlyList<Deteccao> Localizar(string textoNormalizado)
    {
        var todas = new List<Deteccao>();
        foreach (var d in _detectores)
        {
            try { todas.AddRange(d.Detectar(textoNormalizado)); }
            catch (RegexMatchTimeoutException)
            {
                // falha fechada: o texto inteiro conta como a classe do detector que estourou
                todas.Add(new Deteccao(d.Classe, 0, textoNormalizado.Length));
            }
        }
        return todas.OrderBy(x => x.Inicio).ToList();
    }

    private void Valor(string? bruto, string campo, string chaveNorm, IReadOnlyCollection<string>? chavesExtras, List<AchadoPii> achados)
    {
        if (string.IsNullOrWhiteSpace(bruto)) return;
        var texto = Normalizador.Normalizar(bruto);

        var deteccoes = Localizar(texto);
        foreach (var d in deteccoes)
        {
            var fim = Math.Min(texto.Length, d.Inicio + d.Tamanho);
            var inicio = Math.Min(d.Inicio, fim);
            achados.Add(new AchadoPii(campo, d.Classe, texto[inicio..fim], false));
        }
        if (deteccoes.Count > 0) return;   // a classe do valor vence a da chave

        foreach (var classe in ClassesDaChave(chaveNorm, chavesExtras))
            achados.Add(new AchadoPii(campo, classe, texto, true));
    }

    private IEnumerable<PiiClasse> ClassesDaChave(string chaveNorm, IReadOnlyCollection<string>? chavesExtras)
    {
        if (chaveNorm.Length == 0) yield break;
        var vistas = new HashSet<PiiClasse>();
        foreach (var d in _detectores)
            if (d.ChaveIndica(chaveNorm) && vistas.Add(d.Classe)) yield return d.Classe;
        if (chavesExtras is not null && chavesExtras.Contains(chaveNorm) && vistas.Add(PiiClasse.Senha))
            yield return PiiClasse.Senha;
    }
}
