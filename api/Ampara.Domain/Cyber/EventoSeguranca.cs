namespace Ampara.Domain.Cyber;

/// <summary>Evento de segurança. Nunca guarda o valor do dado, só classe, campo e decisão. Persistência é do plano 03.</summary>
public sealed class EventoSeguranca
{
    public Guid Id;
    public DateTimeOffset Em;
    public string CorrelationId = "";
    public OrigemDado Source;
    public string Campo = "";
    public PiiClasse Classe;
    public Sink Sink;
    public Decisao Decisao;
    public Guid? UsuarioAlvoId;
    public string? MensagemCidadao;

    public static EventoSeguranca Novo(DateTimeOffset em, string correlationId, OrigemDado source, string campo,
        PiiClasse classe, Sink sink, Decisao decisao, Guid? usuarioAlvoId) => new()
    {
        Id = Guid.NewGuid(), Em = em, CorrelationId = correlationId, Source = source, Campo = campo,
        Classe = classe, Sink = sink, Decisao = decisao, UsuarioAlvoId = usuarioAlvoId,
    };
}
