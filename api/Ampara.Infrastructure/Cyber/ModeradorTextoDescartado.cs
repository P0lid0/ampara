using Ampara.Application.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Enquanto o plano 03 nao troca por ClaudeModeradorRelato (scrub de PII + Claude), o texto livre NAO e gravado: devolve sempre null.</summary>
public sealed class ModeradorTextoDescartado : IModeradorRelato
{
    public Task<string?> ModerarTextoAsync(string texto, CancellationToken ct) => Task.FromResult<string?>(null);
}
