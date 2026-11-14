using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ampara.Infrastructure.Configuracoes;

public sealed class UsuarioConfiguration : IEntityTypeConfiguration<Usuario>
{
    public void Configure(EntityTypeBuilder<Usuario> b)
    {
        b.ToTable("Usuarios");
        b.HasKey(u => u.Id);
        b.Property(u => u.Nome).HasMaxLength(200).IsRequired();
        b.Property(u => u.Email).HasMaxLength(320).IsRequired();
        b.HasIndex(u => u.Email).IsUnique();
        b.Property(u => u.SenhaHash).HasMaxLength(300).IsRequired();
        b.Property(u => u.Papel).HasMaxLength(20).IsRequired();
        b.Property(u => u.CodigoEmergenciaHash).HasMaxLength(300);
        b.Property(u => u.PalavraSecretaHash).HasMaxLength(300);
        b.Ignore(u => u.TemEmergenciaConfigurada);
    }
}
