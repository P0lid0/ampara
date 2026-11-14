using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class PontoRotaConfiguration : IEntityTypeConfiguration<PontoRota>
{
    public void Configure(EntityTypeBuilder<PontoRota> b)
    {
        b.ToTable("Pontos");
        b.HasKey(p => p.Id);
        b.HasOne<Usuario>().WithMany().HasForeignKey(p => p.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(p => new { p.UsuarioId, p.Em }).IsUnique();
        b.HasIndex(p => p.Em);   // purga por expiração
    }
}
