namespace Ampara.Application.Cyber;

/// <summary>Identificador de correlação da requisição (escopo). Vem do cabeçalho <c>X-Correlation-Id</c> quando casa <c>^[A-Za-z0-9-]{1,64}$</c>; senão é um GUID novo.</summary>
public interface ICorrelacao
{
    string Id { get; }
}
