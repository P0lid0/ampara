using System.Security.Cryptography;
using System.Text;
using Ampara.Application.Comum;

namespace Ampara.Infrastructure.Cripto;

public sealed class CifradorAesGcm : ICifrador
{
    private const int Nonce = 12, Tag = 16;
    private readonly byte[] _chave;

    public CifradorAesGcm(string chaveBase64)
    {
        byte[] chave;
        try { chave = Convert.FromBase64String(chaveBase64 ?? ""); }
        catch (FormatException) { throw new ArgumentException("AMPARA_CRYPTO_KEY deve ser base64 de 32 bytes."); }
        if (chave.Length != 32) throw new ArgumentException("AMPARA_CRYPTO_KEY deve ter 32 bytes.");
        _chave = chave;
    }

    public string Cifrar(string texto)
    {
        var claro = Encoding.UTF8.GetBytes(texto);
        var saida = new byte[Nonce + Tag + claro.Length];
        var nonce = saida.AsSpan(0, Nonce);
        RandomNumberGenerator.Fill(nonce);
        using var aes = new AesGcm(_chave, Tag);
        aes.Encrypt(nonce, claro, saida.AsSpan(Nonce + Tag), saida.AsSpan(Nonce, Tag));
        return Convert.ToBase64String(saida);
    }

    public string Decifrar(string cifrado)
    {
        byte[] bruto;
        try { bruto = Convert.FromBase64String(cifrado); }
        catch (FormatException) { throw new CryptographicException("Cifra inválida."); }
        if (bruto.Length < Nonce + Tag) throw new CryptographicException("Cifra inválida.");
        var claro = new byte[bruto.Length - Nonce - Tag];
        using var aes = new AesGcm(_chave, Tag);
        aes.Decrypt(bruto.AsSpan(0, Nonce), bruto.AsSpan(Nonce + Tag), bruto.AsSpan(Nonce, Tag), claro);
        return Encoding.UTF8.GetString(claro);
    }
}
