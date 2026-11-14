namespace Ampara.Application.Aparelhos;

public sealed record AparelhoCriadoDto(Guid AparelhoId, string ImeiFinal);
public sealed record AparelhoDto(Guid Id, string Marca, string Modelo, string ImeiMascarado);

public interface IAparelhoService
{
    Task<AparelhoCriadoDto> CriarAsync(Guid usuarioId, string imei, string marca, string modelo, CancellationToken ct);

    /// <summary>Só os aparelhos do dono, do mais recente para o mais antigo. O IMEI vai mascarado, sem decifrar.</summary>
    Task<IReadOnlyList<AparelhoDto>> ListarAsync(Guid usuarioId, CancellationToken ct);

    /// <summary>Devolve o texto CIFRADO do IMEI mais recente (ou null). Uso exclusivo do BO (T16), que o entrega a IImeiRevelador.RevelarParaBo.</summary>
    Task<string?> ImeiCifradoMaisRecenteAsync(Guid usuarioId, CancellationToken ct);
}
