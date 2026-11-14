using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class EventoRecebidoConfiguration : IEntityTypeConfiguration<EventoRecebido>
{
    public void Configure(EntityTypeBuilder<EventoRecebido> b)
    {
        b.ToTable("EventosRecebidos");
        b.HasKey(e => e.Id);
        b.Property(e => e.EventId).HasMaxLength(128).IsRequired();
        b.Property(e => e.DeviceId).HasMaxLength(64).IsRequired();
        b.Property(e => e.Tipo).HasMaxLength(16).IsRequired();
        b.HasIndex(e => e.EventId).IsUnique();
    }
}
