namespace Ampara.Application.Risco;

/// <summary>Uma célula da grade com a classe de risco prevista pelo ML para um dia e faixa.</summary>
public sealed record RiscoCelulaDto(string AreaId, double Lat, double Lng, string Classe, double ProbAlto);
