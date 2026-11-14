namespace Ampara.Application.Auth;

public interface IAuthService
{
    Task<Guid> RegistrarAsync(string nome, string email, string senha, CancellationToken ct);
    Task<TokenDto> LoginAsync(string email, string senha, CancellationToken ct);
    Task DefinirEmergenciaAsync(Guid usuarioId, string codigo, string palavraSecreta, CancellationToken ct);
    Task<TokenDto> LoginEmergenciaAsync(string email, string codigo, string palavraSecreta, CancellationToken ct);

    /// <summary>Apaga as tentativas de emergência com mais de 24 h (guardam o e-mail digitado). Devolve quantas.</summary>
    Task<int> PurgarTentativasAsync(CancellationToken ct);
}
