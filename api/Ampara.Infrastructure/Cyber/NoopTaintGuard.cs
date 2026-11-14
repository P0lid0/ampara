using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Implementação do plano 02; o plano 03 substitui por um guard real, sem mudar a assinatura.</summary>
public sealed class NoopTaintGuard : ITaintGuard
{
    public bool Ativo => false;
    public ResultadoTaint Sanitizar(string texto, Sink sink, SanitizarOpcoes? o = null) => new(texto, false, []);
}
