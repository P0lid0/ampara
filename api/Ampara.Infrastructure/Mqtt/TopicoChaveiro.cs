namespace Ampara.Infrastructure.Mqtt;

/// <summary>Convenção de tópicos MQTT do chaveiro (contrato do projeto).</summary>
public static class TopicoChaveiro
{
    public const string RaizEventos = "citizentech/chaveiro/+/events", RaizStatus = "citizentech/chaveiro/+/status";

    public static string Cmd(string deviceId) => $"citizentech/chaveiro/{deviceId}/cmd";

    /// <summary>Lê "citizentech/chaveiro/{deviceId}/{events|status}". Qualquer outra forma (inclusive /cmd) devolve falso.</summary>
    public static bool TentarLer(string topico, out string deviceId, out string tipo)
    {
        deviceId = ""; tipo = "";
        var p = topico?.Split('/');
        if (p is not { Length: 4 } || p[0] != "citizentech" || p[1] != "chaveiro") return false;
        if (p[2].Length == 0 || p[2].AsSpan().IndexOfAny('+', '#') >= 0) return false;
        if (p[3] != "events" && p[3] != "status") return false;
        deviceId = p[2]; tipo = p[3];
        return true;
    }
}
