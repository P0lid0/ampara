using System.Globalization;
using Ampara.Application.Aparelhos;
using Ampara.Application.Comum;
using Ampara.Application.Cyber;
using Ampara.Domain.Comum;
using Ampara.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Ampara.Application.Bo;

public sealed class BoGenerator(
    IAmparaDb db, IAparelhoService aparelhos, IImeiRevelador revelador, IAcessoIndevido acessoIndevido,
    ICifrador cifrador, IDelegaciaLocator delegacias, TimeProvider tempo) : IBoGenerator
{
    /// <summary>Conferir no dia da entrega (site oficial da Delegacia Eletrônica de SP).</summary>
    public const string LinkDelegaciaEletronica = "https://www.delegaciaeletronica.policiacivil.sp.gov.br/";

    public async Task<BoDto> GerarAsync(Ator ator, Guid ocorrenciaId, CancellationToken ct)
    {
        var o = await db.Ocorrencias.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ocorrenciaId, ct)
            ?? throw new NaoEncontradoException("ocorrencia-nao-encontrada");

        // Só o dono gera o BO; guardião (mesmo legítimo) e estranho levam 403 com registro.
        if (ator.UsuarioId != o.UsuarioId)
        {
            acessoIndevido.Registrar(o.UsuarioId, "recurso-de-outro-usuario");
            throw new AcessoNegadoException("ocorrencia-de-outro-usuario");
        }

        if (o is not { MomentoEm: { } momento, MomentoLat: { } lat, MomentoLng: { } lng })
            throw new ConflitoException("momento-nao-marcado");

        var delegacia = delegacias.MaisProxima(lat, lng) ?? throw new ServicoIndisponivelException("delegacias-indisponiveis");

        var imeiCifrado = await aparelhos.ImeiCifradoMaisRecenteAsync(o.UsuarioId, ct);
        var aparelho = await AparelhoMaisRecenteAsync(o.UsuarioId, ct);

        // O BO nunca decifra por conta própria: o IMEI vem sempre do revelador.
        var imei = imeiCifrado is null
            ? null
            : revelador.RevelarParaBo(imeiCifrado, donoId: o.UsuarioId, solicitanteId: ator.UsuarioId);

        var texto = Montar(momento, lat, lng, aparelho, imei);

        var agora = tempo.GetUtcNow().UtcDateTime;
        var cifrado = cifrador.Cifrar(texto);
        var existente = await db.BosRascunho.FirstOrDefaultAsync(b => b.OcorrenciaId == o.Id, ct);
        if (existente is null) db.BosRascunho.Add(BoRascunho.Criar(o.Id, agora, delegacia.Nome, cifrado));
        else existente.Atualizar(agora, delegacia.Nome, cifrado);
        await db.SaveChangesAsync(ct);

        return new BoDto(texto, new DelegaciaDto(delegacia.Nome, delegacia.Endereco, delegacia.Lat, delegacia.Lng), LinkDelegaciaEletronica);
    }

    private async Task<string?> AparelhoMaisRecenteAsync(Guid usuarioId, CancellationToken ct)
    {
        var linhas = await db.Aparelhos.AsNoTracking().Where(a => a.UsuarioId == usuarioId)
            .Select(a => new { a.Marca, a.Modelo, a.CriadoEm }).ToListAsync(ct);
        return linhas.OrderByDescending(a => a.CriadoEm).Select(a => $"{a.Marca} {a.Modelo}").FirstOrDefault();
    }

    private static string Montar(DateTime momentoUtc, double lat, double lng, string? aparelho, string? imei)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(momentoUtc, DateTimeKind.Utc), FusoBrasil.SaoPaulo);
        var c = CultureInfo.InvariantCulture;
        return string.Join("\n",
            "BOLETIM DE OCORRÊNCIA - RASCUNHO GERADO PELO AMPARA",
            "Natureza: Roubo de aparelho celular",
            $"Data e hora do fato: {local.ToString("dd/MM/yyyy HH:mm", c)} (horário de Brasília)",
            $"Local: coordenadas {lat.ToString("F6", c)}, {lng.ToString("F6", c)} (aproximadas), São Paulo/SP",
            $"Aparelho: {aparelho ?? "não informado"}",
            $"IMEI: {imei ?? "não informado"}",
            "Descrição: A vítima relata que teve o aparelho celular subtraído no local e no horário indicados e registrou o fato pelo aplicativo Ampara.",
            "Atenção: este rascunho foi gerado automaticamente a partir do relato da vítima e deve ser conferido antes de registrar o boletim.");
    }
}
