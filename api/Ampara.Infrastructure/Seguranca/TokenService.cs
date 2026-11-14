using System.Text;
using Ampara.Application.Auth;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Ampara.Infrastructure.Seguranca;

public sealed class TokenService : ITokenService
{
    public const int SegredoMinimo = 64;
    public const string Emissor = "ampara-api";
    public const string Audiencia = "ampara";

    private readonly SymmetricSecurityKey _chave;
    private readonly TimeProvider _tempo;
    private readonly JsonWebTokenHandler _handler = new();

    public TokenService(string? segredo, TimeProvider tempo)
    {
        _chave = ChaveDoSegredo(segredo);
        _tempo = tempo;
    }

    /// <summary>Segredo ausente ou com menos de 64 caracteres derruba a subida.</summary>
    public static SymmetricSecurityKey ChaveDoSegredo(string? segredo)
    {
        if (string.IsNullOrEmpty(segredo) || segredo.Length < SegredoMinimo)
            throw new InvalidOperationException($"AMPARA_JWT_SECRET ausente ou com menos de {SegredoMinimo} caracteres.");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(segredo));
    }

    public TokenDto Emitir(Guid usuarioId, string papel, string escopo, TimeSpan validade)
    {
        var agora = _tempo.GetUtcNow().UtcDateTime;
        var expira = agora + validade;
        var descritor = new SecurityTokenDescriptor
        {
            Issuer = Emissor,
            Audience = Audiencia,
            IssuedAt = agora,
            NotBefore = agora,
            Expires = expira,
            Claims = new Dictionary<string, object>
            {
                ["sub"] = usuarioId.ToString(),
                ["role"] = papel,
                ["scope"] = escopo,
            },
            SigningCredentials = new SigningCredentials(_chave, SecurityAlgorithms.HmacSha256),
        };
        return new TokenDto(_handler.CreateToken(descritor), expira);
    }
}
