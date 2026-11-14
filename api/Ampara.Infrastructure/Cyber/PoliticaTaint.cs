using Ampara.Domain.Cyber;

namespace Ampara.Infrastructure.Cyber;

/// <summary>O que fazer com um dado sensível em cada sink. <c>null</c> = o texto passa e nada é registrado.</summary>
public static class PoliticaTaint
{
    public static Decisao? Para(Sink sink, PiiClasse classe) => sink switch
    {
        Sink.Log or Sink.HttpNaoAutenticada or Sink.Erro or Sink.Ponte or Sink.SignalR or Sink.Llm => Decisao.Bloqueado,
        Sink.Banco => classe == PiiClasse.Imei ? Decisao.Cifrado : Decisao.Mascarado,
        // HttpAutenticada existe só para o evento Permitido do IMEI no BO (ImeiRevelador grava); o guard não age.
        _ => null,
    };
}
