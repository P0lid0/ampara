using Ampara.Domain.Cyber;

namespace Ampara.Application.Cyber;

/// <summary>Máscara para exibir e cifra para guardar dado pessoal. Cifra: AES-GCM, texto sai como <c>enc:v1:…</c>.</summary>
public interface IPiiProtetor
{
    string Mascarar(PiiClasse classe, string valor);
    string Cifrar(string texto);
    string Decifrar(string cifrado);
    bool EstaCifrado(string valor);
}
