namespace Ampara.Application.Cyber;

public interface IModeradorRelato
{
    Task<string?> ModerarTextoAsync(string texto, CancellationToken ct);
}
