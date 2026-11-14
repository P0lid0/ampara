using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class TentativaEmergenciaConfiguration : IEntityTypeConfiguration<TentativaEmergencia>
{
    public void Configure(EntityTypeBuilder<TentativaEmergencia> b)
    {
        b.ToTable("TentativasEmergencia");
        b.HasKey(t => t.Id);
        b.Property(t => t.EmailNormalizado).HasMaxLength(320).IsRequired();
        b.HasIndex(t => new { t.EmailNormalizado, t.Em });
    }
}
