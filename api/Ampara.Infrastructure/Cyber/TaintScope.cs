using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Escopo por requisição/mensagem (registrar como Scoped).</summary>
public sealed class TaintScope : ITaintScope
{
    private const int Minimo = 4;
    private readonly List<(string Campo, OrigemDado Origem, PiiClasse Classe, string Valor)> _marcados = [];
    private readonly object _trava = new();

    public Guid? UsuarioAlvoId { get; set; }

    public void Marcar(string valor, OrigemDado origem, string campo, PiiClasse classe)
    {
        if (valor is null || valor.Length < Minimo) return;
        lock (_trava)
        {
            if (_marcados.Any(m => m.Valor == valor && m.Campo == campo && m.Origem == origem)) return;
            _marcados.Add((campo, origem, classe, valor));
        }
    }

    public IReadOnlyList<(string Campo, OrigemDado Origem, PiiClasse Classe, string Valor)> Encontrar(string texto)
    {
        if (string.IsNullOrEmpty(texto)) return [];
        lock (_trava)
            return _marcados.Where(m => texto.Contains(m.Valor, StringComparison.Ordinal)).ToList();
    }
}
