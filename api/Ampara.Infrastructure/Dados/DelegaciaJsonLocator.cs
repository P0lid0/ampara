using System.Text.Json;
using Ampara.Application.Bo;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Infrastructure.Dados;

/// <summary>Delegacias de um JSON [{nome, endereco, lat, lng}], lido uma vez. Arquivo ausente ou inválido = lista vazia + aviso.</summary>
public sealed class DelegaciaJsonLocator : IDelegaciaLocator
{
    private static readonly JsonSerializerOptions Opcoes = new(JsonSerializerDefaults.Web);
    private const double RaioTerraKm = 6371.0088;

    private readonly IReadOnlyList<Delegacia> _itens;

    public DelegaciaJsonLocator(string caminho, ILogger? log = null)
    {
        log ??= NullLogger.Instance;
        _itens = Carregar(caminho, log);
    }

    public int Total => _itens.Count;

    public Delegacia? MaisProxima(double lat, double lng)
    {
        if (!double.IsFinite(lat) || !double.IsFinite(lng)) return null;
        Delegacia? melhor = null;
        var menor = double.MaxValue;
        foreach (var d in _itens)
        {
            var km = DistanciaKm(lat, lng, d.Lat, d.Lng);
            if (km < menor) { menor = km; melhor = d; }
        }
        return melhor;
    }

    public static double DistanciaKm(double lat1, double lng1, double lat2, double lng2)
    {
        static double Rad(double g) => g * Math.PI / 180.0;
        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * RaioTerraKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static IReadOnlyList<Delegacia> Carregar(string caminho, ILogger log)
    {
        try
        {
            if (!File.Exists(caminho))
            {
                log.LogWarning("Arquivo de delegacias ausente: {Caminho}", caminho);
                return [];
            }
            var itens = JsonSerializer.Deserialize<List<Delegacia>>(File.ReadAllText(caminho), Opcoes) ?? [];
            // Item sem nome ou com coordenada inválida não entra: o BO nunca mostra delegacia vazia.
            return itens.Where(i => !string.IsNullOrWhiteSpace(i.Nome) && double.IsFinite(i.Lat) && double.IsFinite(i.Lng)).ToList();
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            log.LogWarning("Arquivo de delegacias ilegível: {Tipo}", ex.GetType().Name);
            return [];
        }
    }
}
