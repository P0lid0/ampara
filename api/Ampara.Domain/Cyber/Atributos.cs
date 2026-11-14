namespace Ampara.Domain.Cyber;

/// <summary>Campo de texto livre: o motor de PII varre o conteúdo em busca de dado pessoal.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class TextoLivreAttribute : Attribute;

/// <summary>Campo que guarda PII, mas só cifrado em repouso.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class PiiCifradoAttribute(PiiClasse classe) : Attribute
{
    public PiiClasse Classe { get; } = classe;
}

/// <summary>Campo ou rota em que estas classes de PII são permitidas por contrato.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter | AttributeTargets.Method | AttributeTargets.Class)]
public sealed class PiiPermitidaAttribute(params PiiClasse[] classes) : Attribute
{
    public PiiClasse[] Classes { get; } = classes;
}
