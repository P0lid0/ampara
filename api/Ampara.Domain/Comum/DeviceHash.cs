using System.Security.Cryptography;
using System.Text;

namespace Ampara.Domain.Comum;

public static class DeviceHash
{
    public static string Calcular(string deviceId, string chaveServico) => Sha256Hex(deviceId + chaveServico);

    public static string SemChaveiro(Guid ocorrenciaId, string chaveServico) =>
        Sha256Hex("sem-chaveiro-" + ocorrenciaId.ToString() + chaveServico);

    private static string Sha256Hex(string s) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
}
