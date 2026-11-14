namespace Ampara.Application.Auth;

public interface ITokenService
{
    TokenDto Emitir(Guid usuarioId, string papel, string escopo, TimeSpan validade);
}
