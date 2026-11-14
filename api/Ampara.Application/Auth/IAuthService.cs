namespace Ampara.Application.Auth;

public interface IAuthService
{
    Task<Guid> RegistrarAsync(string nome, string email, string senha, CancellationToken ct);
    Task<TokenDto> LoginAsync(string email, string senha, CancellationToken ct);
}
