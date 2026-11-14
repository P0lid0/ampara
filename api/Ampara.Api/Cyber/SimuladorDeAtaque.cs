using Ampara.Application.Cyber;
using Ampara.Domain.Cyber;

namespace Ampara.Api.Cyber;

/// <summary>
/// Simulador da demonstração: roda o fluxo REAL (logger protegido, guard, acesso indevido) com valores sintéticos,
/// para o painel mostrar o farol mudando. Só existe com AMPARA_DEMO=true (a rota decide).
/// </summary>
public sealed class SimuladorDeAtaque(ITaintGuard guard, ITaintScope escopo, IAcessoIndevido acessoIndevido, ILoggerFactory logs)
{
    public static readonly string[] Cenarios = ["cpf-no-log", "senha-na-resposta", "laudo-no-erro", "acesso-indevido"];

    private const string SenhaSintetica = "Sintetica!2026";   // SINTETICO
    private const string CpfSintetico = "529.982.247-25";   // SINTETICO (dígitos verificadores válidos)

    public static bool Conhece(string? cenario) => cenario is not null && Cenarios.Contains(cenario);

    public void Executar(string cenario, Guid? alvo, string? correlationId)
    {
        escopo.UsuarioAlvoId = alvo;
        switch (cenario)
        {
            case "cpf-no-log":
                logs.CreateLogger("Ampara.Simulador").LogInformation("Simulador: cadastro recebido com CPF {Cpf}", CpfSintetico);
                break;
            case "senha-na-resposta":
                // Como na requisição real: o valor entra pelo corpo (marcado no escopo) e a resposta o ecoa.
                escopo.Marcar(SenhaSintetica, OrigemDado.Http, "senha", PiiClasse.Senha);
                guard.Sanitizar($$"""{"usuario":"demo","senha":"{{SenhaSintetica}}"}""", Sink.HttpNaoAutenticada,
                    new(OrigemDado.Http, "senha", alvo, correlationId));
                break;
            case "laudo-no-erro":
                guard.Sanitizar("Falha ao gravar o laudo medico anexado ao registro", Sink.Erro,
                    new(OrigemDado.Http, "texto", alvo, correlationId));
                break;
            case "acesso-indevido":
                acessoIndevido.Registrar(alvo, IndiceRisco.CampoCodigoEmergencia, correlationId);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(cenario));
        }
    }
}
