using Ampara.Application.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Ampara.Infrastructure;

public class AmparaDbContext(DbContextOptions<AmparaDbContext> options) : DbContext(options), IAmparaDb
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();

    protected override void ConfigureConventions(ModelConfigurationBuilder cb)
    {
        // Toda data sai e entra como UTC (Npgsql timestamptz rejeita Kind != Utc).
        cb.Properties<DateTime>().HaveConversion<DataUtcConversor>();
        cb.Properties<DateTime?>().HaveConversion<DataUtcNulavelConversor>();
        // Enums gravados como texto.
        cb.Properties<Enum>().HaveConversion<string>();
    }

    protected override void OnModelCreating(ModelBuilder mb) => mb.ApplyConfigurationsFromAssembly(typeof(AmparaDbContext).Assembly);

    public async Task<T> TransacaoAsync<T>(Func<Task<T>> acao, CancellationToken ct = default)
    {
        var estrategia = Database.CreateExecutionStrategy();
        return await estrategia.ExecuteAsync(async () =>
        {
            await using var tx = await Database.BeginTransactionAsync(ct);
            var r = await acao();
            await tx.CommitAsync(ct);
            return r;
        });
    }

    private sealed class DataUtcConversor() : ValueConverter<DateTime, DateTime>(
        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    private sealed class DataUtcNulavelConversor() : ValueConverter<DateTime?, DateTime?>(
        v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v.Value : v.Value.ToUniversalTime()) : v,
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
}
