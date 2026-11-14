using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class BoRascunhoConfiguration : IEntityTypeConfiguration<BoRascunho>
{
    public void Configure(EntityTypeBuilder<BoRascunho> b)
    {
        b.ToTable("BosRascunho");
        b.HasKey(x => x.Id);
        b.Property(x => x.DelegaciaNome).HasMaxLength(200).IsRequired();
        b.Property(x => x.TextoCifrado).IsRequired();
        // Um rascunho por ocorrência (upsert).
        b.HasIndex(x => x.OcorrenciaId).IsUnique();
        b.HasOne<Ocorrencia>().WithMany().HasForeignKey(x => x.OcorrenciaId).OnDelete(DeleteBehavior.Cascade);
    }
}
