using Ampara.Application.Cyber;

namespace Ampara.Infrastructure.Cyber;

public sealed class NoopAcessoIndevido : IAcessoIndevido
{
    public void Registrar(Guid? usuarioAlvoId, string campo, string? correlationId = null) { }
}
