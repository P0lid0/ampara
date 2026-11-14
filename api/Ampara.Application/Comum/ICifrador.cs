namespace Ampara.Application.Comum;

/// <summary>Cifra de campo sensível. Formato: base64(nonce12 | tag16 | ciphertext).</summary>
public interface ICifrador
{
    string Cifrar(string texto);
    string Decifrar(string cifrado);
}
