using Ampara.Application.Risco;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ampara.Infrastructure.Risco;

/// <summary>Importa o RISCO_CSV ao subir. Ausente ou inválido: aviso no log e a API segue com risco vazio.</summary>
public sealed class RiscoInicializador(IRiscoService risco, IConfiguration cfg, ILogger<RiscoInicializador> log) : IHostedService
{
    public Task StartAsync(CancellationToken ct)
    {
        var configurado = cfg["RISCO_CSV"];
        if (string.IsNullOrWhiteSpace(configurado))
        {
            log.LogWarning("RISCO_CSV nao configurado: a API sobe com risco vazio.");
            return Task.CompletedTask;
        }
        var caminho = Path.GetFullPath(configurado);
        if (!File.Exists(caminho) && !Path.IsPathRooted(configurado)) caminho = Path.Combine(AppContext.BaseDirectory, configurado);
        try
        {
            risco.Importar(caminho);
            log.LogInformation("Risco importado de {Arquivo}.", caminho);
        }
        catch (Exception ex)
        {
            log.LogWarning("Risco nao importado de {Arquivo} ({Tipo}): a API sobe com risco vazio.", caminho, ex.GetType().Name);
        }
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
