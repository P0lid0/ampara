namespace Ampara.Application.Bo;

public sealed record DelegaciaDto(string Nome, string Endereco, double Lat, double Lng);
public sealed record BoDto(string Texto, DelegaciaDto Delegacia, string LinkDelegaciaEletronica);
