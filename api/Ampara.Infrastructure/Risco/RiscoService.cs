using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Ampara.Application.Comum;
using Ampara.Application.Risco;

namespace Ampara.Infrastructure.Risco;

/// <summary>Risco por célula/dia/faixa lido do CSV do ML. O snapshot é imutável e trocado atomicamente.</summary>
public sealed partial class RiscoService : IRiscoService
{
    private const string Cabecalho = "area_id,lat,lng,dia_semana,faixa,classe,prob_alto";
    private const int Maximo = 5000;
    private static readonly string[] Classes = ["baixo", "medio", "alto"];

    [GeneratedRegex(@"^g\d{3}_\d{3}$")]
    private static partial Regex PadraoArea();

    private sealed class Snapshot(Dictionary<(string, int, int), RiscoCelulaDto> porChave, RiscoCelulaDto[][] porDiaFaixa)
    {
        public Dictionary<(string, int, int), RiscoCelulaDto> PorChave { get; } = porChave;
        public RiscoCelulaDto[][] PorDiaFaixa { get; } = porDiaFaixa;   // índice dia * 8 + faixa
    }

    private Snapshot _atual = new([], Enumerable.Range(0, 56).Select(_ => Array.Empty<RiscoCelulaDto>()).ToArray());

    public void Importar(string caminho)
    {
        string[] linhas;
        try { linhas = File.ReadAllLines(caminho, new UTF8Encoding(false, true)); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or DecoderFallbackException or ArgumentException or NotSupportedException)
        { throw new DominioException("risco-csv-invalido"); }

        if (linhas.Length == 0 || linhas[0].TrimStart('﻿').TrimEnd() != Cabecalho) throw new DominioException("risco-csv-invalido");

        var porChave = new Dictionary<(string, int, int), RiscoCelulaDto>();
        var listas = Enumerable.Range(0, 56).Select(_ => new List<RiscoCelulaDto>()).ToArray();
        foreach (var bruta in linhas.Skip(1))
        {
            var linha = bruta.TrimEnd();
            if (linha.Length == 0) continue;
            var c = linha.Split(',');
            if (c.Length != 7 || !PadraoArea().IsMatch(c[0])
                || !Num(c[1], out var lat) || !Num(c[2], out var lng) || lat is < -90 or > 90 || lng is < -180 or > 180
                || !int.TryParse(c[3], NumberStyles.None, CultureInfo.InvariantCulture, out var dia) || dia > 6
                || !int.TryParse(c[4], NumberStyles.None, CultureInfo.InvariantCulture, out var faixa) || faixa > 7
                || Array.IndexOf(Classes, c[5]) < 0
                || !Num(c[6], out var prob) || prob is < 0 or > 1)
                throw new DominioException("risco-csv-invalido");
            var celula = new RiscoCelulaDto(c[0], lat, lng, c[5], prob);
            if (!porChave.TryAdd((c[0], dia, faixa), celula)) throw new DominioException("risco-csv-invalido");   // chave repetida
            listas[dia * 8 + faixa].Add(celula);
        }

        var novo = new Snapshot(porChave,
            listas.Select(l => l.OrderByDescending(x => x.ProbAlto).ThenBy(x => x.AreaId, StringComparer.Ordinal).ToArray()).ToArray());
        Interlocked.Exchange(ref _atual, novo);
    }

    public IReadOnlyList<RiscoCelulaDto> Consultar(double minLat, double minLng, double maxLat, double maxLng, int dia, int faixa)
    {
        if (dia is < 0 or > 6 || faixa is < 0 or > 7) return [];
        var lista = Volatile.Read(ref _atual).PorDiaFaixa[dia * 8 + faixa];
        return lista.Where(c => c.Lat >= minLat && c.Lat <= maxLat && c.Lng >= minLng && c.Lng <= maxLng).Take(Maximo).ToArray();
    }

    public string? ClasseDe(string areaId, int dia, int faixa) =>
        areaId is not null && Volatile.Read(ref _atual).PorChave.TryGetValue((areaId, dia, faixa), out var c) ? c.Classe : null;

    private static bool Num(string s, out double v) =>
        double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v) && double.IsFinite(v);
}
