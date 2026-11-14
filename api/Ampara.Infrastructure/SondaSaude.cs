using Ampara.Application.Comum;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure;

public sealed class SondaSaude(IServiceScopeFactory escopos) : ISondaSaude
{
    public async Task<bool> BancoOkAsync(CancellationToken ct)
    {
        using var limite = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limite.CancelAfter(TimeSpan.FromSeconds(2));
        try
        {
            using var escopo = escopos.CreateScope();
            return await escopo.ServiceProvider.GetRequiredService<AmparaDbContext>().Database.CanConnectAsync(limite.Token);
        }
        catch { return false; }
    }
}
