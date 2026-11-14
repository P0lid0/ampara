using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Comum;
using Ampara.Domain.Cyber;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Policia;

public sealed class PoliciaService(IAmparaDb db, IPontePoliciaClient ponte, ITaintGuard taint, IAcessoIndevido acessoIndevido, OpcoesPonte opcoes) : IPoliciaService
{
    public const int MaximoPontosTrilha = 500;
    public const string TipoRoubo = "roubo_celular";

    public async Task<string> CompartilharAsync(Ator ator, Guid ocorrenciaId, bool consentimento, CancellationToken ct)
    {
        var o = await CarregarDoDonoAsync(ator, ocorrenciaId, rastrear: true, ct);

        if (!consentimento) throw new DominioException("consentimento-ausente");
        if (o.ProtocoloPolicia is { } existente) return existente;
        if (o is not { MomentoEm: { } momento, MomentoLat: { } lat, MomentoLng: { } lng })
            throw new ConflitoException("momento-nao-marcado");

        var payload = await MontarAsync(o, momento, lat, lng, ct);
        payload = Sanitizar(payload, o.UsuarioId);

        // Se a Ponte falhar, a exceção sobe e nada é gravado: uma nova tentativa funciona.
        var resposta = await ponte.EnviarAsync(payload, ct);
        o.RegistrarProtocoloPolicia(resposta.Protocolo);
        await db.SaveChangesAsync(ct);
        return resposta.Protocolo;
    }

    public async Task<RetornoDto> RetornoAsync(Ator ator, Guid ocorrenciaId, CancellationToken ct)
    {
        var o = await CarregarDoDonoAsync(ator, ocorrenciaId, rastrear: false, ct);
        if (o.ProtocoloPolicia is not { } protocolo) throw new NaoEncontradoException("ocorrencia-nao-compartilhada");

        var r = await ponte.ObterRetornoAsync(protocolo, ct) ?? throw new NaoEncontradoException("retorno-indisponivel");
        return new RetornoDto(r.Protocolo, r.Status, r.Mensagem, r.AtualizadoEm, o.BoNumero, o.BoStatus, o.Recuperacao);
    }

    public async Task DefinirAcompanhamentoAsync(Ator ator, Guid ocorrenciaId, AcompanhamentoEntrada e, CancellationToken ct)
    {
        var o = await CarregarDoDonoAsync(ator, ocorrenciaId, rastrear: true, ct);
        o.DefinirAcompanhamento(e?.BoNumero, e?.BoStatus, e?.Recuperacao);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Ocorrencia> CarregarDoDonoAsync(Ator ator, Guid ocorrenciaId, bool rastrear, CancellationToken ct)
    {
        var consulta = rastrear ? db.Ocorrencias.AsQueryable() : db.Ocorrencias.AsNoTracking();
        var o = await consulta.FirstOrDefaultAsync(x => x.Id == ocorrenciaId, ct)
            ?? throw new NaoEncontradoException("ocorrencia-nao-encontrada");
        // Só o dono (ou a emergência dele): guardião, mesmo legítimo, e estranho levam 403 com registro.
        if (ator.UsuarioId != o.UsuarioId)
        {
            acessoIndevido.Registrar(o.UsuarioId, "recurso-de-outro-usuario");
            throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
        }
        return o;
    }

    private async Task<PonteOcorrencia> MontarAsync(Ocorrencia o, DateTime momento, double lat, double lng, CancellationToken ct)
    {
        var deviceHash = await DeviceHashAsync(o, ct);

        IReadOnlyList<PontoTrilha> trilha = [];
        var consenteRota = await db.Usuarios.AsNoTracking().Where(u => u.Id == o.UsuarioId).Select(u => u.ConsentimentoRota).FirstOrDefaultAsync(ct);
        if (consenteRota)
        {
            var pontos = await db.Pontos.AsNoTracking().Where(p => p.UsuarioId == o.UsuarioId && p.Em >= momento).ToListAsync(ct);
            trilha = pontos.OrderBy(p => p.Em).Take(MaximoPontosTrilha)
                .Select(p => new PontoTrilha(p.Lat, p.Lng, DateTime.SpecifyKind(p.Em, DateTimeKind.Utc))).ToList();
        }

        return new PonteOcorrencia(o.Id, AreaMapa.AreaId(lat, lng), DateTime.SpecifyKind(momento, DateTimeKind.Utc),
            TipoRoubo, o.Origem.ToString().ToLowerInvariant(), deviceHash, trilha);
    }

    private async Task<string> DeviceHashAsync(Ocorrencia o, CancellationToken ct)
    {
        var deviceId = o.ChaveiroDeviceId;
        if (string.IsNullOrEmpty(deviceId))
        {
            var chaveiros = await db.Chaveiros.AsNoTracking().Where(c => c.UsuarioId == o.UsuarioId).Select(c => new { c.DeviceId, c.PareadoEm }).ToListAsync(ct);
            deviceId = chaveiros.OrderBy(c => c.PareadoEm).Select(c => c.DeviceId).FirstOrDefault();
        }
        return string.IsNullOrEmpty(deviceId)
            ? DeviceHash.SemChaveiro(o.Id, opcoes.ChaveServico)
            : DeviceHash.Calcular(deviceId, opcoes.ChaveServico);
    }

    /// <summary>Passa cada string do payload pelo taint guard (sink Ponte). Bloqueado em qualquer uma: nada é enviado.</summary>
    private PonteOcorrencia Sanitizar(PonteOcorrencia p, Guid donoId)
    {
        var bloqueado = false;
        string S(string valor, string campo)
        {
            var r = taint.Sanitizar(valor, Sink.Ponte, new SanitizarOpcoes(OrigemDado.Http, campo, donoId));
            bloqueado |= r.Bloqueado;
            return r.Texto;
        }
        var saida = p with
        {
            AreaId = S(p.AreaId, "ponte.area_id"),
            Tipo = S(p.Tipo, "ponte.tipo"),
            OrigemGatilho = S(p.OrigemGatilho, "ponte.origem_gatilho"),
            DeviceHash = S(p.DeviceHash, "ponte.device_hash"),
        };
        if (bloqueado) throw new ServicoIndisponivelException("ponte-payload-bloqueado");
        return saida;
    }
}
