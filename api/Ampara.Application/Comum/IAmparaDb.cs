using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Comum;

/// <summary>Porta de dados da aplicação. Cada tarefa acrescenta o DbSet da sua entidade.</summary>
public interface IAmparaDb
{
    DbSet<Usuario> Usuarios { get; }
    DbSet<TentativaEmergencia> TentativasEmergencia { get; }
    DbSet<Aparelho> Aparelhos { get; }
    DbSet<CatalogoConta> Catalogo { get; }
    DbSet<ContaVinculada> Contas { get; }
    DbSet<Convite> Convites { get; }
    DbSet<Guardiao> Guardioes { get; }
    DbSet<Chaveiro> Chaveiros { get; }
    DbSet<PontoRota> Pontos { get; }
    DbSet<Ocorrencia> Ocorrencias { get; }
    DbSet<PassoOcorrencia> Passos { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// <summary>Executa a ação numa transação (com a estratégia de execução do provedor).</summary>
    Task<T> TransacaoAsync<T>(Func<Task<T>> acao, CancellationToken ct = default);

    /// <summary>Trava de aviso (advisory lock) por chave, válida até o fim da transação atual. Só tem efeito no PostgreSQL.</summary>
    Task TravarPorChaveAsync(string chave, CancellationToken ct = default);
}

public static class Escopos
{
    public const string Usuario = "usuario";
    public const string Emergencia = "emergencia";
}

public sealed record Ator(Guid UsuarioId, string Escopo);
