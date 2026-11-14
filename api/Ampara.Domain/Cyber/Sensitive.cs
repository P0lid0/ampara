using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ampara.Domain.Cyber;

/// <summary>Dado pessoal embrulhado: ToString e JSON nunca mostram o valor, só a classe.</summary>
[JsonConverter(typeof(SensitiveJsonConverterFactory))]
public readonly record struct Sensitive<T>(T Valor, PiiClasse Classe, string Campo)
{
    public override string ToString() => $"[PII:{Classe}]";
}

public sealed class SensitiveJsonConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type t) => t.IsGenericType && t.GetGenericTypeDefinition() == typeof(Sensitive<>);

    public override JsonConverter CreateConverter(Type t, JsonSerializerOptions o) =>
        (JsonConverter)Activator.CreateInstance(typeof(SensitiveJsonConverter<>).MakeGenericType(t.GetGenericArguments()[0]))!;
}

/// <summary>Só escreve; ler um Sensitive de JSON não faz sentido (o valor nunca sai).</summary>
public sealed class SensitiveJsonConverter<T> : JsonConverter<Sensitive<T>>
{
    public override Sensitive<T> Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) =>
        throw new NotSupportedException("Sensitive<T> nao e desserializavel: o valor nunca sai em JSON.");

    public override void Write(Utf8JsonWriter w, Sensitive<T> v, JsonSerializerOptions o) => w.WriteStringValue(v.ToString());
}
