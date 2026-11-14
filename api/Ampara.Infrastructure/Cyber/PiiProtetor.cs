using System.Security.Cryptography;
using System.Text;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure.Cripto;
using Microsoft.Extensions.Configuration;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Máscaras por classe de PII e cifra AES-GCM (<c>enc:v1:</c> + base64 de nonce|cifrado|tag).
/// Também é o <see cref="ICifrador"/> da API: o que os serviços gravam já sai com o prefixo.
/// <see cref="Decifrar"/> ainda lê o formato antigo do <see cref="CifradorAesGcm"/> (base64 sem prefixo).
/// </summary>
public sealed class PiiProtetor : IPiiProtetor, ICifrador
{
    public const string Prefixo = "enc:v1:";
    private const int Nonce = 12, Tag = 16;
    private readonly byte[] _chave;
    private readonly CifradorAesGcm _antigo;

    public PiiProtetor(IConfiguration c)
    {
        var chave = c["AMPARA_CRYPTO_KEY"];
        if (string.IsNullOrWhiteSpace(chave))
            throw new InvalidOperationException("AMPARA_CRYPTO_KEY ausente (base64 de 32 bytes).");
        _antigo = new CifradorAesGcm(chave);   // valida base64 e tamanho (ArgumentException, sem ecoar o valor)
        _chave = Convert.FromBase64String(chave);
    }

    public bool EstaCifrado(string valor) => valor is not null && valor.StartsWith(Prefixo, StringComparison.Ordinal);

    public string Cifrar(string texto)
    {
        var claro = Encoding.UTF8.GetBytes(texto);
        var saida = new byte[Nonce + claro.Length + Tag];
        RandomNumberGenerator.Fill(saida.AsSpan(0, Nonce));
        using var aes = new AesGcm(_chave, Tag);
        aes.Encrypt(saida.AsSpan(0, Nonce), claro, saida.AsSpan(Nonce, claro.Length), saida.AsSpan(Nonce + claro.Length, Tag));
        return Prefixo + Convert.ToBase64String(saida);
    }

    public string Decifrar(string cifrado)
    {
        if (!EstaCifrado(cifrado)) return _antigo.Decifrar(cifrado);
        byte[] bruto;
        try { bruto = Convert.FromBase64String(cifrado[Prefixo.Length..]); }
        catch (FormatException) { throw new CryptographicException("Cifra inválida."); }
        if (bruto.Length < Nonce + Tag) throw new CryptographicException("Cifra inválida.");
        var n = bruto.Length - Nonce - Tag;
        var claro = new byte[n];
        using var aes = new AesGcm(_chave, Tag);
        try { aes.Decrypt(bruto.AsSpan(0, Nonce), bruto.AsSpan(Nonce, n), bruto.AsSpan(Nonce + n, Tag), claro); }
        catch (CryptographicException) { throw new CryptographicException("Cifra inválida ou adulterada."); }
        return Encoding.UTF8.GetString(claro);
    }

    public string Mascarar(PiiClasse classe, string valor)
    {
        valor ??= "";
        return classe switch
        {
            PiiClasse.Cpf => MascararCpf(valor),
            PiiClasse.Email => MascararEmail(valor),
            PiiClasse.Telefone => MascararTelefone(valor),
            PiiClasse.Placa => MascararPlaca(valor),
            PiiClasse.Senha => "********",
            PiiClasse.Rg => MascararMantendo(valor, 1),
            PiiClasse.Imei => MascararMantendo(valor, 4),
            PiiClasse.Saude => "[dado de saúde]",
            _ => "********",
        };
    }

    private static string Alfanum(string v) => new(v.Where(char.IsLetterOrDigit).ToArray());

    private static string MascararCpf(string v)
    {
        var d = new string(v.Where(char.IsDigit).ToArray());
        return d.Length == 11 ? $"***.{d[3..6]}.***-{d[9..]}" : MascararMantendo(v, 2);
    }

    private static string MascararEmail(string v)
    {
        var arroba = v.LastIndexOf('@');
        if (arroba < 1) return "***";
        return $"{v[0]}***{v[arroba..]}";
    }

    private static string MascararTelefone(string v)
    {
        var d = new string(v.Where(char.IsDigit).ToArray());
        if (d.Length is 12 or 13 && d.StartsWith("55")) d = d[2..];
        if (d.Length is not (10 or 11)) return MascararMantendo(v, 4);
        return $"({d[..2]}) {new string('*', d.Length - 6)}-{d[^4..]}";
    }

    private static string MascararPlaca(string v)
    {
        var a = Alfanum(v);
        return a.Length < 4 ? new string('*', a.Length) : a[..3] + new string('*', a.Length - 3);
    }

    /// <summary>Troca letras e dígitos por '*' e mantém a pontuação e os últimos <paramref name="manter"/> caracteres alfanuméricos.</summary>
    private static string MascararMantendo(string v, int manter)
    {
        var total = v.Count(char.IsLetterOrDigit);
        var sb = new StringBuilder(v.Length);
        var i = 0;
        foreach (var ch in v)
        {
            if (!char.IsLetterOrDigit(ch)) { sb.Append(ch); continue; }
            sb.Append(i++ >= total - manter ? ch : '*');
        }
        return sb.ToString();
    }
}
