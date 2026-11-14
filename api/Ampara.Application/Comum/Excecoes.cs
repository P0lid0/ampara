namespace Ampara.Application.Comum;

/// <summary>Base das exceções de negócio. O código é um slug estável (nunca um valor do usuário).</summary>
public abstract class AmparaException(string codigo) : Exception(codigo)
{
    public string Codigo { get; } = codigo;
}

public sealed class DominioException(string codigo) : AmparaException(codigo);
public sealed class NaoEncontradoException(string codigo) : AmparaException(codigo);
public sealed class AcessoNegadoException(string codigo) : AmparaException(codigo);
public sealed class ConflitoException(string codigo) : AmparaException(codigo);
public sealed class RecursoVencidoException(string codigo) : AmparaException(codigo);
public sealed class NaoAutenticadoException(string codigo) : AmparaException(codigo);
public sealed class ServicoIndisponivelException(string codigo) : AmparaException(codigo);

public sealed class LimiteExcedidoException(string codigo, TimeSpan retryAfter) : AmparaException(codigo)
{
    public TimeSpan RetryAfter { get; } = retryAfter;
}
