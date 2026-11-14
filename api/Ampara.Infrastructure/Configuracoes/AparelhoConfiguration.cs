using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class AparelhoConfiguration : IEntityTypeConfiguration<Aparelho>
{
    public void Configure(EntityTypeBuilder<Aparelho> b)
    {
        b.ToTable("Aparelhos");
        b.HasKey(a => a.Id);
        b.Property(a => a.ImeiCifrado).HasMaxLength(256).IsRequired();
        b.Property(a => a.ImeiFinal).HasMaxLength(4).IsRequired();
        b.Property(a => a.Marca).HasMaxLength(60).IsRequired();
        b.Property(a => a.Modelo).HasMaxLength(60).IsRequired();
        b.HasOne<Usuario>().WithMany().HasForeignKey(a => a.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(a => new { a.UsuarioId, a.CriadoEm });
    }
}
