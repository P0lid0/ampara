using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class CatalogoContaConfiguration : IEntityTypeConfiguration<CatalogoConta>
{
    public void Configure(EntityTypeBuilder<CatalogoConta> b)
    {
        b.ToTable("Catalogo");
        b.HasKey(c => c.Id);
        b.Property(c => c.Id).HasMaxLength(40);
        b.Property(c => c.Nome).HasMaxLength(80).IsRequired();
        b.Property(c => c.Tipo).HasMaxLength(20).IsRequired();
        b.Property(c => c.Telefone).HasMaxLength(20);
        b.Property(c => c.Link).HasMaxLength(300).IsRequired();
        b.Property(c => c.ConferidoEm).HasMaxLength(10);
    }
}

public sealed class ContaVinculadaConfiguration : IEntityTypeConfiguration<ContaVinculada>
{
    public void Configure(EntityTypeBuilder<ContaVinculada> b)
    {
        b.ToTable("Contas");
        b.HasKey(c => c.Id);
        b.Property(c => c.CatalogoIdCifrado).HasMaxLength(256).IsRequired();
        b.HasOne<Usuario>().WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(c => c.UsuarioId);
    }
}
