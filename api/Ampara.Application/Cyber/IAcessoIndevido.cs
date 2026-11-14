namespace Ampara.Application.Cyber;

public interface IAcessoIndevido
{
    /// <param name="campo">"codigo-emergencia" ou "recurso-de-outro-usuario".</param>
    void Registrar(Guid? usuarioAlvoId, string campo, string? correlationId = null);
}
