using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Comum;

/// <summary>Porta de dados da aplicação. Cada tarefa acrescenta o DbSet da sua entidade.</summary>
public interface IAmparaDb
{
    DbSet<Usuario> Usuarios { get; }
    DbSet<TentativaEmergencia> TentativasEmergencia { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// <summary>Executa a ação numa transação (com a estratégia de execução do provedor).</summary>
    Task<T> TransacaoAsync<T>(Func<Task<T>> acao, CancellationToken ct = default);
}

public static class Escopos
{
    public const string Usuario = "usuario";
    public const string Emergencia = "emergencia";
}

public sealed record Ator(Guid UsuarioId, string Escopo);
