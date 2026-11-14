using Ampara.Domain.Cyber;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Cyber;

/// <summary>Mapeia os campos publicos de EventoSeguranca. Nenhuma coluna guarda o valor do dado.</summary>
public sealed class EventoSegurancaConfig : IEntityTypeConfiguration<EventoSeguranca>
{
    public void Configure(EntityTypeBuilder<EventoSeguranca> b)
    {
        b.ToTable("evento_seguranca");
        b.Property<Guid>(nameof(EventoSeguranca.Id));
        b.HasKey(nameof(EventoSeguranca.Id));
        b.Property<DateTimeOffset>(nameof(EventoSeguranca.Em));
        b.Property<string>(nameof(EventoSeguranca.CorrelationId)).HasMaxLength(128).IsRequired();
        b.Property<OrigemDado>(nameof(EventoSeguranca.Source));
        b.Property<string>(nameof(EventoSeguranca.Campo)).HasMaxLength(120).IsRequired();
        b.Property<PiiClasse>(nameof(EventoSeguranca.Classe));
        b.Property<Sink>(nameof(EventoSeguranca.Sink));
        b.Property<Decisao>(nameof(EventoSeguranca.Decisao));
        b.Property<Guid?>(nameof(EventoSeguranca.UsuarioAlvoId));
        b.Property<string?>(nameof(EventoSeguranca.MensagemCidadao)).HasMaxLength(500);
        b.HasIndex(nameof(EventoSeguranca.UsuarioAlvoId), nameof(EventoSeguranca.Em));
    }
}
