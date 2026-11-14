namespace Ampara.Application.Alertas;

public sealed record AlertaDisparadoMsg(Guid AlertaId, Guid OcorrenciaId, string VitimaNome, string Origem, DateTime Em);

/// <summary>ParaGuardiaoId é Guardiao.Id (não o usuarioId). JSON: {alertaId, ocorrenciaId, paraGuardiaoId, em}.</summary>
public sealed record AlertaEscaladoMsg(Guid AlertaId, Guid OcorrenciaId, Guid ParaGuardiaoId, DateTime Em);

/// <summary>Motivo: ciente | cancelado | encerrado.</summary>
public sealed record AlertaEncerradoMsg(Guid AlertaId, string Motivo);

public sealed record PassoAtualizadoMsg(Guid OcorrenciaId, string Passo, DateTime ConcluidoEm);
