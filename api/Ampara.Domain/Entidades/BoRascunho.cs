namespace Ampara.Domain.Entidades;

/// <summary>Rascunho de boletim de ocorrência gerado para uma ocorrência (um por ocorrência). O texto só existe cifrado.</summary>
public sealed class BoRascunho
{
    public Guid Id { get; private set; }
    public Guid OcorrenciaId { get; private set; }
    public DateTime GeradoEm { get; private set; }
    public string DelegaciaNome { get; private set; } = "";
    public string TextoCifrado { get; private set; } = "";

    private BoRascunho() { }

    public static BoRascunho Criar(Guid ocorrenciaId, DateTime geradoEm, string delegaciaNome, string textoCifrado) => new()
    {
        Id = Guid.NewGuid(),
        OcorrenciaId = ocorrenciaId,
        GeradoEm = DateTime.SpecifyKind(geradoEm, DateTimeKind.Utc),
        DelegaciaNome = delegaciaNome,
        TextoCifrado = textoCifrado,
    };

    /// <summary>Regerar o BO da mesma ocorrência substitui o rascunho anterior.</summary>
    public void Atualizar(DateTime geradoEm, string delegaciaNome, string textoCifrado)
    {
        GeradoEm = DateTime.SpecifyKind(geradoEm, DateTimeKind.Utc);
        DelegaciaNome = delegaciaNome;
        TextoCifrado = textoCifrado;
    }
}
