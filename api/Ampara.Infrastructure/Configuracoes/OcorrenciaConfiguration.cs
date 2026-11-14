using Ampara.Domain;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class OcorrenciaConfiguration : IEntityTypeConfiguration<Ocorrencia>
{
    public void Configure(EntityTypeBuilder<Ocorrencia> b)
    {
        b.ToTable("Ocorrencias");
        b.HasKey(o => o.Id);
        b.Property(o => o.ChaveiroDeviceId).HasMaxLength(64);
        b.Property(o => o.ChaveiroAlertId).HasMaxLength(128);
        b.Property(o => o.ProtocoloPolicia).HasMaxLength(64);
        b.HasOne<Usuario>().WithMany().HasForeignKey(o => o.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        // No máximo uma ocorrência Aberta por vítima (a corrida de dois gatilhos termina no índice).
        b.HasIndex(o => o.UsuarioId).IsUnique().HasDatabaseName("UX_Ocorrencias_UmaAbertaPorUsuario")
            .HasFilter($"\"Estado\" = '{nameof(EstadoOcorrencia.Aberta)}'");
        b.HasIndex(o => new { o.ChaveiroDeviceId, o.ChaveiroAlertId });
        b.HasMany(o => o.Passos).WithOne().HasForeignKey(p => p.OcorrenciaId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PassoOcorrenciaConfiguration : IEntityTypeConfiguration<PassoOcorrencia>
{
    public void Configure(EntityTypeBuilder<PassoOcorrencia> b)
    {
        b.ToTable("PassosOcorrencia");
        b.HasKey(p => p.Id);
        b.HasIndex(p => new { p.OcorrenciaId, p.Passo }).IsUnique();
    }
}
