namespace Ampara.Api.Endpoints;

public static class MapAmpara
{
    /// <summary>Registra as rotas de todas as áreas. Cada tarefa acrescenta a sua linha.</summary>
    public static IEndpointRouteBuilder MapAmparaEndpoints(this IEndpointRouteBuilder rotas)
    {
        rotas.MapAuth();
        rotas.MapMe();
        rotas.MapAparelhos();
        rotas.MapContas();
        rotas.MapGuardioes();
        rotas.MapChaveiros();
        rotas.MapRota();
        return rotas;
    }
}
