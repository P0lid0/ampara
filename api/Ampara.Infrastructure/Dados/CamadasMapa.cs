using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Infrastructure.Dados;

public sealed record PontoCamada(string Nome, double Lat, double Lng);

/// <summary>Camadas do mapa (delegacias, estações, PM) lidas de Dados/{tipo}.json na subida e mantidas em memória.</summary>
public sealed class CamadasMapa
{
    public static readonly IReadOnlyList<string> Tipos = ["delegacias", "estacoes", "pm"];

    private static readonly JsonSerializerOptions Opcoes = new(JsonSerializerDefaults.Web);
    private readonly Dictionary<string, IReadOnlyList<PontoCamada>> _camadas = new();

    public CamadasMapa(string pasta, ILogger? log = null)
    {
        log ??= NullLogger.Instance;
        foreach (var tipo in Tipos) _camadas[tipo] = Ler(Path.Combine(pasta, tipo + ".json"), log);
    }

    /// <summary>null quando o tipo não existe; lista (possivelmente vazia) quando existe.</summary>
    public IReadOnlyList<PontoCamada>? Obter(string tipo) => _camadas.GetValueOrDefault(tipo);

    private static IReadOnlyList<PontoCamada> Ler(string caminho, ILogger log)
    {
        try
        {
            if (!File.Exists(caminho))
            {
                log.LogWarning("Camada do mapa ausente: {Caminho}", caminho);
                return [];
            }
            // Só nome, lat e lng: o resto do item (ex.: endereco) nunca sai pela rota pública.
            return (JsonSerializer.Deserialize<List<PontoCamada>>(File.ReadAllText(caminho), Opcoes) ?? [])
                .Where(p => !string.IsNullOrWhiteSpace(p.Nome) && double.IsFinite(p.Lat) && double.IsFinite(p.Lng)).ToList();
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            log.LogWarning("Camada do mapa ilegível ({Caminho}): {Tipo}", caminho, ex.GetType().Name);
            return [];
        }
    }
}
