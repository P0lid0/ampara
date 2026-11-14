using Ampara.Application.Comum;

namespace Ampara.Domain.Entidades;

/// <summary>Uma ocorrência de roubo/furto de celular, aberta por um gatilho. No máximo uma Aberta por vítima (índice parcial).</summary>
public sealed class Ocorrencia
{
    public const int BoNumeroMaximo = 40;
    public const string BoNaoRegistrado = "nao_registrado", BoRegistrado = "registrado";
    public const string SemNoticia = "sem_noticia", Localizado = "localizado", Recuperado = "recuperado";

    private static readonly TimeSpan ToleranciaFuturo = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan JanelaPassado = TimeSpan.FromDays(7);

    public Guid Id { get; private set; }
    public Guid UsuarioId { get; private set; }
    public OrigemGatilho Origem { get; private set; }
    public EstadoOcorrencia Estado { get; private set; }
    public DateTime IniciadaEm { get; private set; }
    public DateTime? EncerradaEm { get; private set; }
    public DateTime? MomentoEm { get; private set; }
    public double? MomentoLat { get; private set; }
    public double? MomentoLng { get; private set; }
    public string? ChaveiroDeviceId { get; internal set; }
    public string? ChaveiroAlertId { get; internal set; }
    /// <summary>Janela de cancelamento do impacto: antes disso nenhum alerta sai. Nulo = alertas imediatos.</summary>
    public DateTime? AlertasLiberadosEm { get; internal set; }
    public string? ProtocoloPolicia { get; private set; }
    public string? BoNumero { get; private set; }
    public string BoStatus { get; private set; } = BoNaoRegistrado;
    public string Recuperacao { get; private set; } = SemNoticia;
    public List<PassoOcorrencia> Passos { get; private set; } = [];

    private Ocorrencia() { }

    public static Ocorrencia Iniciar(Guid usuarioId, OrigemGatilho origem, DateTime iniciadaEm)
    {
        var o = new Ocorrencia
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Origem = origem,
            Estado = EstadoOcorrencia.Aberta,
            IniciadaEm = DateTime.SpecifyKind(iniciadaEm, DateTimeKind.Utc),
        };
        o.Passos = Enum.GetValues<PassoBloqueio>().Select(p => PassoOcorrencia.Pendente(o.Id, p)).ToList();
        return o;
    }

    public void MarcarMomento(DateTime em, double lat, double lng, DateTime agora)
    {
        if (Estado == EstadoOcorrencia.Cancelada) throw new DominioException("ocorrencia-cancelada");
        if (!double.IsFinite(lat) || lat is < -90 or > 90 || !double.IsFinite(lng) || lng is < -180 or > 180)
            throw new DominioException("coordenada-invalida");
        var emUtc = em.Kind == DateTimeKind.Utc ? em : em.ToUniversalTime();
        if (emUtc > agora + ToleranciaFuturo || emUtc < IniciadaEm - JanelaPassado)
            throw new DominioException("momento-invalido");
        MomentoEm = DateTime.SpecifyKind(emUtc, DateTimeKind.Utc);
        MomentoLat = lat;
        MomentoLng = lng;
    }

    public void RegistrarProtocoloPolicia(string protocolo) => ProtocoloPolicia = protocolo;

    /// <summary>Acompanhamento da vítima (fica só na API). Valor fora do conjunto ou número com mais de 40 caracteres: acompanhamento-invalido.</summary>
    public void DefinirAcompanhamento(string? boNumero, string? boStatus, string? recuperacao)
    {
        var numero = string.IsNullOrWhiteSpace(boNumero) ? null : boNumero.Trim();
        if (numero is { Length: > BoNumeroMaximo }
            || boStatus is not (BoNaoRegistrado or BoRegistrado)
            || recuperacao is not (SemNoticia or Localizado or Recuperado))
            throw new DominioException("acompanhamento-invalido");
        BoNumero = numero;
        BoStatus = boStatus;
        Recuperacao = recuperacao;
    }

    public void Cancelar(DateTime agora) => Fechar(EstadoOcorrencia.Cancelada, agora);

    public void Encerrar(DateTime agora) => Fechar(EstadoOcorrencia.Encerrada, agora);

    private void Fechar(EstadoOcorrencia novo, DateTime agora)
    {
        if (Estado != EstadoOcorrencia.Aberta) throw new ConflitoException("ocorrencia-nao-aberta");
        Estado = novo;
        EncerradaEm = DateTime.SpecifyKind(agora, DateTimeKind.Utc);
    }

    /// <summary>Idempotente: repetir não muda o horário. Devolve true quando os cinco passos estão concluídos.</summary>
    public bool ConcluirPasso(PassoBloqueio passo, DateTime agora)
    {
        Passos.Single(p => p.Passo == passo).Concluir(agora);
        return Passos.All(p => p.ConcluidoEm.HasValue);
    }
}
