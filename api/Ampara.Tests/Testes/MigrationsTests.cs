using Ampara.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Tests;

public class MigrationsTests
{
    [Fact]
    public void Modelo_bate_com_as_migrations_do_postgres()
    {
        // A suíte cria o esquema do modelo no SQLite (EnsureCreated); este teste pega a migration esquecida, que só
        // quebraria o --migrar na VM. Npgsql sem conexão: a comparação é entre o modelo e o snapshot.
        var opcoes = new DbContextOptionsBuilder<AmparaDbContext>()
            .UseNpgsql("Host=localhost;Database=sem-conexao;Username=teste;Password=falsa").Options;
        using var db = new AmparaDbContext(opcoes);
        Assert.False(db.Database.HasPendingModelChanges(), "Há mudança no modelo EF sem migration: rode dotnet ef migrations add.");
    }
}
