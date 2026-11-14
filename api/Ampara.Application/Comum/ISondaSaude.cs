namespace Ampara.Application.Comum;

/// <summary>Verifica dependências para o /health. Implementação real: banco (CanConnect, até 2 s).</summary>
public interface ISondaSaude
{
    Task<bool> BancoOkAsync(CancellationToken ct);
}
