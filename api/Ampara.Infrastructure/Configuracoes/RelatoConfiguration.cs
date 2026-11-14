using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class RelatoConfiguration : IEntityTypeConfiguration<Relato>
{
    public void Configure(EntityTypeBuilder<Relato> b)
    {
        b.ToTable("Relatos");
        b.HasKey(r => r.Id);
        b.Property(r => r.AreaId).HasMaxLength(16);
        b.Property(r => r.Texto).HasMaxLength(500);
        b.HasOne<Usuario>().WithMany().HasForeignKey(r => r.AutorId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(r => r.Em);                    // listagem e purga por expiracao
        b.HasIndex(r => new { r.AutorId, r.CriadoEm });   // limite de 5 por hora
    }
}

public sealed class RelatoConfirmacaoConfiguration : IEntityTypeConfiguration<RelatoConfirmacao>
{
    public void Configure(EntityTypeBuilder<RelatoConfirmacao> b)
    {
        b.ToTable("RelatoConfirmacoes");
        b.HasKey(c => c.Id);
        b.HasOne<Relato>().WithMany().HasForeignKey(c => c.RelatoId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Usuario>().WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(c => new { c.RelatoId, c.UsuarioId }).IsUnique();
    }
}
