using System.Text;
using System.Text.Json;

namespace Ampara.Application.Chaveiros;

/// <summary>Evento publicado pelo chaveiro em .../events (contrato MQTT). Lido de forma tolerante: payload ruim vira null, nunca exceção.</summary>
public sealed record MensagemChaveiro(string EventId, string Tipo, string DeviceId, string? AlertId, long? Ts, int AgeMs, int? Battery)
{
    public const int LimiteBytes = 2048;
    public static readonly IReadOnlySet<string> TiposValidos = new HashSet<string> { "alert", "cancel", "test", "low_battery" };

    public static MensagemChaveiro? Ler(string? payload)
    {
        if (string.IsNullOrEmpty(payload) || Encoding.UTF8.GetByteCount(payload) > LimiteBytes) return null;
        try
        {
            using var doc = JsonDocument.Parse(payload);
            var r = doc.RootElement;
            if (r.ValueKind != JsonValueKind.Object) return null;

            if (!Texto(r, "eventId", true, 128, out var eventId) || !Texto(r, "type", true, 32, out var tipo)
                || !Texto(r, "deviceId", true, 64, out var deviceId) || !Texto(r, "alertId", false, 128, out var alertId)) return null;
            if (!TiposValidos.Contains(tipo!)) return null;
            if (!Inteiro(r, "ts", out var ts) || !Inteiro(r, "ageMs", out var age) || !Inteiro(r, "battery", out var bat)) return null;
            // Campos auxiliares fora da faixa não derrubam o evento (um pedido de socorro não pode se perder por telemetria ruim):
            // viram "sem valor" e o evento segue. Só tipo errado ou texto grande demais descarta.
            if (ts is < 0 or > 253402300799) ts = null;                          // fora do intervalo de DateTime
            if (age is < 0 or > int.MaxValue) age = null;
            if (bat is < 0 or > 100) bat = null;
            return new MensagemChaveiro(eventId!, tipo!, deviceId!, alertId, ts, (int)(age ?? 0), (int?)bat);
        }
        catch (JsonException) { return null; }
    }

    private static bool Texto(JsonElement r, string nome, bool obrigatorio, int max, out string? valor)
    {
        valor = null;
        if (!r.TryGetProperty(nome, out var e) || e.ValueKind == JsonValueKind.Null) return !obrigatorio;
        if (e.ValueKind != JsonValueKind.String) return false;
        valor = e.GetString();
        if (valor is { } v && v.Length > max) return false;                   // maior que a coluna do banco
        return !obrigatorio || !string.IsNullOrWhiteSpace(valor);
    }

    // Ausente ou null vale "sem valor"; qualquer tipo que não seja inteiro é payload inválido.
    private static bool Inteiro(JsonElement r, string nome, out long? valor)
    {
        valor = null;
        if (!r.TryGetProperty(nome, out var e) || e.ValueKind == JsonValueKind.Null) return true;
        if (e.ValueKind != JsonValueKind.Number || !e.TryGetInt64(out var n)) return false;
        valor = n;
        return true;
    }
}

/// <summary>Mensagem retida de .../status: {deviceId, online, battery?}.</summary>
public sealed record StatusChaveiro(string DeviceId, bool Online, int? Battery)
{
    public static StatusChaveiro? Ler(string? payload)
    {
        if (string.IsNullOrEmpty(payload) || Encoding.UTF8.GetByteCount(payload) > MensagemChaveiro.LimiteBytes) return null;
        try
        {
            using var doc = JsonDocument.Parse(payload);
            var r = doc.RootElement;
            if (r.ValueKind != JsonValueKind.Object) return null;
            if (!r.TryGetProperty("deviceId", out var d) || d.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(d.GetString()) || d.GetString()!.Length > 64) return null;
            if (!r.TryGetProperty("online", out var o) || o.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return null;
            int? bat = null;
            if (r.TryGetProperty("battery", out var b) && b.ValueKind != JsonValueKind.Null)
            {
                if (b.ValueKind != JsonValueKind.Number || !b.TryGetInt32(out var n)) return null;
                if (n is >= 0 and <= 100) bat = n;                              // fora da faixa: ignora a bateria, mantém o status
            }
            return new StatusChaveiro(d.GetString()!, o.GetBoolean(), bat);
        }
        catch (JsonException) { return null; }
    }
}
