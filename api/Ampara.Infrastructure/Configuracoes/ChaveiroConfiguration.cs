using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class ChaveiroConfiguration : IEntityTypeConfiguration<Chaveiro>
{
    public void Configure(EntityTypeBuilder<Chaveiro> b)
    {
        b.ToTable("Chaveiros");
        b.HasKey(c => c.Id);
        b.Property(c => c.DeviceId).HasMaxLength(64).IsRequired();
        b.HasIndex(c => c.DeviceId).IsUnique();
        b.HasOne<Usuario>().WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(c => c.UsuarioId);
    }
}
