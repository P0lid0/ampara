using Ampara.Application.Comum;

namespace Ampara.Tests.Infra;

/// <summary>Sonda de saúde falsável: troque BancoOk para simular o banco fora do ar.</summary>
public sealed class FakeSondaSaude : ISondaSaude
{
    public bool BancoOk { get; set; } = true;

    public Task<bool> BancoOkAsync(CancellationToken ct) => Task.FromResult(BancoOk);
}
