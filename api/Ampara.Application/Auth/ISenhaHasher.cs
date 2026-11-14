namespace Ampara.Application.Auth;

/// <summary>PBKDF2-SHA256, no mínimo 100000 iterações, salt aleatório por hash.</summary>
public interface ISenhaHasher
{
    string Hash(string texto);
    bool Verificar(string texto, string hash);
}
