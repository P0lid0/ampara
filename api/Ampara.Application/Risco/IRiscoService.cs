namespace Ampara.Application.Risco;

public interface IRiscoService
{
    /// <summary>Valida o arquivo inteiro; só troca o snapshot se tudo for válido, senão DominioException("risco-csv-invalido").</summary>
    void Importar(string caminho);

    /// <summary>Células da bbox para o dia (0 = segunda) e a faixa (0-7), no máximo 5000, as de maior probAlto primeiro.</summary>
    IReadOnlyList<RiscoCelulaDto> Consultar(double minLat, double minLng, double maxLat, double maxLng, int dia, int faixa);

    /// <summary>Classe da célula no dia e faixa; null se não há linha.</summary>
    string? ClasseDe(string areaId, int dia, int faixa);
}
