using Ampara.Application.Comum;

namespace Ampara.Application.Rota;

public sealed record PontoRotaEntrada(double Lat, double Lng, double? Precisao, DateTime Em);

public sealed record PontoRotaDto(double Lat, double Lng, DateTime Em);

public interface IRotaService
{
    /// <summary>Tudo ou nada: valida o lote inteiro antes de gravar. Pontos já existentes (UsuarioId, Em) são ignorados.</summary>
    Task RegistrarLoteAsync(Guid usuarioId, IReadOnlyList<PontoRotaEntrada> pontos, CancellationToken ct);

    /// <summary>Só a rota do próprio ator; padrão = últimos 7 dias; ordem crescente; no máximo 20000 pontos.</summary>
    Task<IReadOnlyList<PontoRotaDto>> ConsultarAsync(Ator ator, DateTime? de, DateTime? ate, CancellationToken ct);

    /// <summary>Apaga os pontos com Em anterior a agora - 7 dias. Devolve quantos.</summary>
    Task<int> PurgarExpiradosAsync(CancellationToken ct);

    Task ApagarTudoAsync(Guid usuarioId, CancellationToken ct);
}
