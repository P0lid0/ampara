using System.Security.Cryptography;
using Ampara.Application.Auth;

namespace Ampara.Infrastructure.Seguranca;

/// <summary>Formato: pbkdf2-sha256$iteracoes$saltBase64$hashBase64.</summary>
public sealed class SenhaHasherPbkdf2 : ISenhaHasher
{
    private const string Prefixo = "pbkdf2-sha256";
    private const int Iteracoes = 210_000;
    private const int TamSalt = 16;
    private const int TamHash = 32;

    public string Hash(string texto)
    {
        var salt = RandomNumberGenerator.GetBytes(TamSalt);
        var h = Rfc2898DeriveBytes.Pbkdf2(texto, salt, Iteracoes, HashAlgorithmName.SHA256, TamHash);
        return $"{Prefixo}${Iteracoes}${Convert.ToBase64String(salt)}${Convert.ToBase64String(h)}";
    }

    public bool Verificar(string texto, string hash)
    {
        var p = (hash ?? "").Split('$');
        if (p.Length != 4 || p[0] != Prefixo || !int.TryParse(p[1], out var it) || it < 100_000) return false;
        try
        {
            var salt = Convert.FromBase64String(p[2]);
            var esperado = Convert.FromBase64String(p[3]);
            var h = Rfc2898DeriveBytes.Pbkdf2(texto, salt, it, HashAlgorithmName.SHA256, esperado.Length);
            return CryptographicOperations.FixedTimeEquals(h, esperado);
        }
        catch (FormatException) { return false; }
    }
}
