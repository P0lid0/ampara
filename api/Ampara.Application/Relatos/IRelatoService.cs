using Ampara.Domain;

namespace Ampara.Application.Relatos;

public sealed record RelatoEntrada(TipoRelato Tipo, double Lat, double Lng, DateTime Em, string? Texto);

public sealed record RelatoDto(Guid Id, string Tipo, double Lat, double Lng, DateTime Em, int Confirmacoes);

public interface IRelatoService
{
    /// <summary>O autor conta como a 1a confirmacao. Em fora de [agora-2h, agora+5min], fora do mapa ou 6o relato na hora falham.</summary>
    Task<Guid> CriarAsync(Guid autorId, RelatoEntrada e, CancellationToken ct);

    /// <summary>Idempotente por usuario.</summary>
    Task ConfirmarAsync(Guid usuarioId, Guid relatoId, CancellationToken ct);

    /// <summary>Visiveis na bbox: Em nas ultimas 2 h e (2+ confirmacoes ou area de risco alto agora). No maximo 200.</summary>
    Task<IReadOnlyList<RelatoDto>> ListarVisiveisAsync(double minLat, double minLng, double maxLat, double maxLng, CancellationToken ct);

    /// <summary>Apaga os relatos (e confirmacoes) com Em anterior a agora - 2 h. Devolve quantos relatos.</summary>
    Task<int> PurgarExpiradosAsync(CancellationToken ct);
}
