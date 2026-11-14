using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;
using Ampara.Infrastructure;
using Ampara.Infrastructure.Cyber;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ampara.Tests.Cyber;

public class RastroSegurancaTests
{
    private static readonly Guid A = Guid.Parse("00000000-0000-0000-0000-0000000000a1");
    private static readonly Guid B = Guid.Parse("00000000-0000-0000-0000-0000000000b2");
    private static readonly DateTimeOffset Agora = new(2026, 11, 14, 12, 0, 0, TimeSpan.Zero);

    private static EventoSeguranca Ev(Guid? alvo = null, DateTimeOffset? em = null) =>
        EventoSeguranca.Novo(em ?? Agora, "cid", OrigemDado.Http, "x", PiiClasse.Cpf, Sink.Log, Decisao.Mascarado, alvo);

    private static AmparaDbContext NovoDb(string nome) =>
        new(new DbContextOptionsBuilder<AmparaDbContext>().UseInMemoryDatabase(nome).Options);

    private sealed class RepoFake : IEventoSegurancaRepository
    {
        public List<EventoSeguranca> Itens { get; } = new();
        public int Chamadas;
        public Task AdicionarAsync(EventoSeguranca e, CancellationToken ct = default)
        {
            if (Interlocked.Increment(ref Chamadas) == 1) throw new InvalidOperationException("banco fora do ar 12345678900");
            Itens.Add(e);
            return Task.CompletedTask;
        }
        public Task<IReadOnlyList<EventoSeguranca>> DesdeAsync(DateTimeOffset desde, Guid? usuarioAlvoId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<EventoSeguranca>>(Itens);
    }

    [Fact]
    public void Registrar_nao_lanca_com_fila_cheia()
    {
        var r = new RastroSeguranca();
        for (var i = 0; i < 1500; i++) r.Registrar(Ev());
        Assert.Equal(1000, r.Leitor.Count);
    }

    [Fact]
    public async Task Worker_sobrevive_a_falha_do_banco()
    {
        var repo = new RepoFake();
        var sp = new ServiceCollection().AddSingleton<IEventoSegurancaRepository>(repo).BuildServiceProvider();
        var w = new RastroSegurancaWorker(new RastroSeguranca(), sp.GetRequiredService<IServiceScopeFactory>(), NullLogger<RastroSegurancaWorker>.Instance);

        await w.ProcessarAsync(Ev(), CancellationToken.None);   // 1a chamada lanca: nao propaga
        await w.ProcessarAsync(Ev(), CancellationToken.None);   // 2a persiste

        Assert.Single(repo.Itens);
    }

    [Fact]
    public async Task Desde_filtra_por_usuario_e_janela()
    {
        await using var db = NovoDb(nameof(Desde_filtra_por_usuario_e_janela));
        var repo = new EventoSegurancaRepository(db);
        await repo.AdicionarAsync(Ev(A, Agora.AddHours(-1)));
        await repo.AdicionarAsync(Ev(A, Agora.AddHours(-2)));
        await repo.AdicionarAsync(Ev(A, Agora.AddHours(-30)));   // fora da janela
        await repo.AdicionarAsync(Ev(B, Agora.AddHours(-1)));    // outro usuario

        var r = await repo.DesdeAsync(Agora.AddHours(-24), A);

        Assert.Equal(2, r.Count);
        Assert.All(r, e => Assert.Equal(A, e.UsuarioAlvoId));
        Assert.Equal(3, (await repo.DesdeAsync(Agora.AddHours(-24), null)).Count);
    }

    [Fact]
    public void Modelo_nao_tem_coluna_de_valor()
    {
        using var db = NovoDb(nameof(Modelo_nao_tem_coluna_de_valor));
        Assert.Equal(
            new[] { "Campo", "Classe", "CorrelationId", "Decisao", "Em", "Id", "MensagemCidadao", "Sink", "Source", "UsuarioAlvoId" },
            db.Model.FindEntityType(typeof(EventoSeguranca))!.GetProperties().Select(p => p.Name).OrderBy(n => n).ToArray());
    }
}
