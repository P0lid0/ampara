using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class ConviteConfiguration : IEntityTypeConfiguration<Convite>
{
    public void Configure(EntityTypeBuilder<Convite> b)
    {
        b.ToTable("Convites");
        b.HasKey(c => c.Id);
        b.Property(c => c.Codigo).HasMaxLength(6).IsRequired();
        b.HasIndex(c => c.Codigo).IsUnique();
        b.HasIndex(c => c.UsuarioId);
        b.HasOne<Usuario>().WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class GuardiaoConfiguration : IEntityTypeConfiguration<Guardiao>
{
    public void Configure(EntityTypeBuilder<Guardiao> b)
    {
        b.ToTable("Guardioes");
        b.HasKey(g => g.Id);
        // Sem índice único em (UsuarioId, Ordem): a troca de ordem regrava as linhas na mesma operação.
        b.HasIndex(g => new { g.UsuarioId, g.Ordem });
        b.HasIndex(g => new { g.UsuarioId, g.GuardiaoUsuarioId }).IsUnique();
        b.HasOne<Usuario>().WithMany().HasForeignKey(g => g.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Usuario>().WithMany().HasForeignKey(g => g.GuardiaoUsuarioId).OnDelete(DeleteBehavior.Cascade);
    }
}
