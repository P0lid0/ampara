using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>Valores sensíveis vistos na entrada da requisição/mensagem, para achá-los de novo na saída mesmo sem padrão.</summary>
public interface ITaintScope
{
    Guid? UsuarioAlvoId { get; set; }

    /// <summary>Registra só valores com 4 caracteres ou mais.</summary>
    void Marcar(string valor, OrigemDado origem, string campo, PiiClasse classe);

    /// <summary>Comparação exata, sensível a caixa.</summary>
    IReadOnlyList<(string Campo, OrigemDado Origem, PiiClasse Classe, string Valor)> Encontrar(string texto);
}
