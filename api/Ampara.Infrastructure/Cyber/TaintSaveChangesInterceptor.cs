using System.Collections.Concurrent;
using System.Reflection;
using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Ampara.Infrastructure.Cyber;

/// <summary>
/// Sink Banco: ao salvar, propriedades [TextoLivre] passam pelo guard (PII mascarada) e propriedades [PiiCifrado]
/// em texto puro são cifradas (as já cifradas, com prefixo enc:v1:, ficam como estão).
/// </summary>
public sealed class TaintSaveChangesInterceptor(ITaintGuard guard, IPiiProtetor protetor, IRastroSeguranca rastro, ICorrelacao? correlacao = null)
    : SaveChangesInterceptor
{
    private readonly record struct Campo(string Nome, bool Livre, PiiClasse Classe);

    private static readonly ConcurrentDictionary<Type, Campo[]> Cache = new();

    public override InterceptionResult<int> SavingChanges(DbContextEventData e, InterceptionResult<int> r)
    {
        if (e.Context is not null) Proteger(e.Context);
        return r;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e, InterceptionResult<int> r, CancellationToken ct = default)
    {
        if (e.Context is not null) Proteger(e.Context);
        return ValueTask.FromResult(r);
    }

    private void Proteger(DbContext db)
    {
        if (!guard.Ativo) return;
        foreach (var entrada in db.ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified).ToList())
        {
            var campos = CamposDe(entrada.Entity.GetType());
            if (campos.Length == 0) continue;
            foreach (var c in campos)
            {
                var prop = entrada.Property(c.Nome);
                if (entrada.State == EntityState.Modified && !prop.IsModified) continue;
                if (prop.CurrentValue is not string texto || texto.Length == 0) continue;
                if (c.Livre) Mascarar(prop, texto);
                else Cifrar(prop, texto, c);
            }
        }
    }

    private void Mascarar(PropertyEntry prop, string texto)
    {
        var r = guard.Sanitizar(texto, Sink.Banco, new SanitizarOpcoes(Campo: prop.Metadata.Name));
        if (!ReferenceEquals(r.Texto, texto) && r.Texto != texto) prop.CurrentValue = r.Texto;
    }

    private void Cifrar(PropertyEntry prop, string texto, Campo c)
    {
        if (protetor.EstaCifrado(texto)) return;
        prop.CurrentValue = protetor.Cifrar(texto);
        try
        {
            rastro.Registrar(EventoSeguranca.Novo(TimeProvider.System.GetUtcNow(), correlacao?.Id ?? "", OrigemDado.Http, c.Nome, c.Classe, Sink.Banco, Decisao.Cifrado, null));
        }
        catch { /* falha do rastro nunca altera o resultado */ }
    }

    private static Campo[] CamposDe(Type tipo) => Cache.GetOrAdd(tipo, t =>
        t.GetProperties(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            .Where(p => p.PropertyType == typeof(string))
            .Select(p => (p, cifrado: p.GetCustomAttribute<PiiCifradoAttribute>(), livre: p.GetCustomAttribute<TextoLivreAttribute>() is not null))
            .Where(x => x.cifrado is not null || x.livre)
            .Select(x => new Campo(x.p.Name, x.cifrado is null, x.cifrado?.Classe ?? default))
            .ToArray());
}
