using Ampara.Application.Auth;
using Ampara.Application.Comum;
using Ampara.Domain.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Infrastructure.Dados;

/// <summary>
/// Dados sinteticos da demonstracao. So roda com AMPARA_DEMO=true (Program.cs). E o unico caminho que cria um admin:
/// <c>registrar</c> nunca cria. Nada aqui e dado de pessoa real.
/// </summary>
public static class DemoSeeder
{
    public const string SenhaDemo = "Demo!2026-sintetico";   // SINTETICO
    public const string EmailAdmin = "admin@ampara.demo";
    public const string EmailVitima = "vitima@ampara.demo";
    public const string EmailGuardiao1 = "guardiao1@ampara.demo";
    public const string EmailGuardiao2 = "guardiao2@ampara.demo";
    public const string CodigoEmergencia = "482915";          // SINTETICO
    public const string PalavraSecreta = "girassol";          // SINTETICO
    public const string ImeiDemo = "490154203237518";         // SINTETICO (IMEI de exemplo com Luhn valido)

    /// <summary>Idempotente: cada passo confere o que ja existe antes de criar.</summary>
    public static async Task SemearAsync(IAmparaDb db, ISenhaHasher hasher, ICifrador cifrador, TimeProvider tempo, CancellationToken ct)
    {
        var agora = tempo.GetUtcNow().UtcDateTime;

        var admin = await ObterOuCriarAsync(db, hasher, "Admin Demonstracao", EmailAdmin, agora, ct);
        if (admin.Papel != Papeis.Admin)
        {
            // Só promove a conta que o próprio seeder criou (senha da demonstração). Conta registrada por terceiro com
            // o mesmo e-mail, enquanto o demo estava desligado, não vira admin.
            if (!hasher.Verificar(SenhaDemo, admin.SenhaHash))
                throw new InvalidOperationException($"{EmailAdmin} já existe sem papel admin e com outra senha; o seeder não a promove.");
            admin.PromoverAAdmin();
            await db.SaveChangesAsync(ct);
        }

        var vitima = await ObterOuCriarAsync(db, hasher, "Vitima Demonstracao", EmailVitima, agora, ct);
        var g1 = await ObterOuCriarAsync(db, hasher, "Guardiao Um", EmailGuardiao1, agora, ct);
        var g2 = await ObterOuCriarAsync(db, hasher, "Guardiao Dois", EmailGuardiao2, agora, ct);

        var mudou = false;
        if (!vitima.ConsentimentoRota) { vitima.AtualizarConsentimentoRota(true, agora); mudou = true; }
        if (!vitima.TemEmergenciaConfigurada) { vitima.DefinirEmergencia(hasher.Hash(CodigoEmergencia), hasher.Hash(PalavraSecreta)); mudou = true; }

        if (!await db.Aparelhos.AnyAsync(a => a.UsuarioId == vitima.Id, ct))
        {
            var imei = Imei.Normalizar(ImeiDemo);
            if (!Imei.Valido(imei)) throw new InvalidOperationException("IMEI da demonstracao invalido.");
            db.Aparelhos.Add(Aparelho.Criar(vitima.Id, cifrador.Cifrar(imei), imei[^4..], "Marca Demo", "Modelo Demo", agora));
            mudou = true;
        }

        var vinculados = await db.Guardioes.Where(g => g.UsuarioId == vitima.Id).Select(g => g.GuardiaoUsuarioId).ToListAsync(ct);
        var ordem = vinculados.Count;
        foreach (var guardiao in new[] { g1, g2 })
        {
            if (vinculados.Contains(guardiao.Id)) continue;
            db.Guardioes.Add(new Guardiao
            {
                Id = Guid.NewGuid(),
                UsuarioId = vitima.Id,
                GuardiaoUsuarioId = guardiao.Id,
                Ordem = ++ordem,
                CriadoEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc),
            });
            mudou = true;
        }

        if (mudou) await db.SaveChangesAsync(ct);
    }

    private static async Task<Usuario> ObterOuCriarAsync(IAmparaDb db, ISenhaHasher hasher, string nome, string email, DateTime agora, CancellationToken ct)
    {
        var u = await db.Usuarios.SingleOrDefaultAsync(x => x.Email == email, ct);
        if (u is not null) return u;
        u = Usuario.Criar(nome, email, hasher.Hash(SenhaDemo), agora);
        db.Usuarios.Add(u);
        await db.SaveChangesAsync(ct);
        return u;
    }
}
