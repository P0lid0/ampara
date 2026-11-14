using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ampara.Application.Comum;
using Ampara.Application.Policia;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ampara.Infrastructure.Ponte;

/// <summary>Cliente HTTP da Ponte Polícia. Qualquer falha vira ServicoIndisponivelException("ponte-indisponivel"); a chave e o corpo nunca são logados.</summary>
public sealed class PontePoliciaClient(HttpClient http) : IPontePoliciaClient
{
    public const string CabecalhoChave = "X-Chave-Servico";

    /// <summary>Serializador do contrato (os nomes snake_case vêm dos atributos; datas UTC saem com Z).</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<PonteProtocolo> EnviarAsync(PonteOcorrencia o, CancellationToken ct)
    {
        try
        {
            using var resposta = await http.PostAsJsonAsync("ocorrencias", o, Json, ct);
            if (!resposta.IsSuccessStatusCode) throw Indisponivel();
            return await resposta.Content.ReadFromJsonAsync<PonteProtocolo>(Json, ct) ?? throw Indisponivel();
        }
        catch (Exception ex) when (Falha(ex, ct)) { throw Indisponivel(); }
    }

    public async Task<PonteRetorno?> ObterRetornoAsync(string protocolo, CancellationToken ct)
    {
        try
        {
            using var resposta = await http.GetAsync($"ocorrencias/{Uri.EscapeDataString(protocolo)}/retorno", ct);
            if (resposta.StatusCode == HttpStatusCode.NotFound) return null;
            if (!resposta.IsSuccessStatusCode) throw Indisponivel();
            return await resposta.Content.ReadFromJsonAsync<PonteRetorno>(Json, ct) ?? throw Indisponivel();
        }
        catch (Exception ex) when (Falha(ex, ct)) { throw Indisponivel(); }
    }

    private static ServicoIndisponivelException Indisponivel() => new("ponte-indisponivel");

    // Cancelamento pedido pelo chamador não é falha da Ponte; timeout (TaskCanceledException sem ct cancelado) é.
    private static bool Falha(Exception ex, CancellationToken ct) =>
        ex is HttpRequestException or JsonException or NotSupportedException
        || ex is OperationCanceledException && !ct.IsCancellationRequested;
}

public static class PonteDependencyInjection
{
    /// <summary>Registra o cliente: base PONTE_URL (padrão http://localhost:8000), timeout 5 s, cabeçalho X-Chave-Servico = PONTE_CHAVE_SERVICO.</summary>
    public static IServiceCollection AddPontePolicia(this IServiceCollection services)
    {
        services.AddSingleton(sp =>
        {
            var chave = sp.GetRequiredService<IConfiguration>()["PONTE_CHAVE_SERVICO"];
            if (string.IsNullOrWhiteSpace(chave))
                throw new InvalidOperationException("PONTE_CHAVE_SERVICO ausente.");
            return new OpcoesPonte(chave);
        });
        services.AddHttpClient<IPontePoliciaClient, PontePoliciaClient>((sp, c) =>
        {
            var url = sp.GetRequiredService<IConfiguration>()["PONTE_URL"];
            if (string.IsNullOrWhiteSpace(url)) url = "http://localhost:8000";
            c.BaseAddress = new Uri(url.TrimEnd('/') + "/");
            c.Timeout = TimeSpan.FromSeconds(5);
            c.DefaultRequestHeaders.Add(PontePoliciaClient.CabecalhoChave, sp.GetRequiredService<OpcoesPonte>().ChaveServico);
        });
        return services;
    }
}
