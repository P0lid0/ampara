import { chamar } from './cliente';
import type {
  AlertaDto, AparelhoDto, BoDto, Bbox, BoStatus, CamadaPontoDto, ChaveiroDto, ContaCatalogo, ContaDto,
  ConviteDto, GuardiaoDto, MeDto, OcorrenciaDto, Passo, PontoRota, PontoRotaDto, Recuperacao, RelatoDto,
  RelatoNovo, RetornoDto, RiscoDto, Token,
} from './tipos';

const e = encodeURIComponent;
const q = (b: Bbox) => `minLat=${b.minLat}&minLng=${b.minLng}&maxLat=${b.maxLat}&maxLng=${b.maxLng}`;

export const api = {
  auth: {
    registrar: (b: { nome: string; email: string; senha: string }) =>
      chamar<{ usuarioId: string }>('/auth/registrar', { metodo: 'POST', corpo: b, semAuth: true }),
    login: (b: { email: string; senha: string }) =>
      chamar<Token>('/auth/login', { metodo: 'POST', corpo: b, semAuth: true }),
    emergencia: (b: { email: string; codigo: string; palavraSecreta: string }) =>
      chamar<Token>('/auth/emergencia', { metodo: 'POST', corpo: b, semAuth: true }),
  },
  me: {
    obter: () => chamar<MeDto>('/me'),
    definirEmergencia: (b: { codigo: string; palavraSecreta: string }) =>
      chamar<void>('/me/emergencia', { metodo: 'PUT', corpo: b }),
    consentimentoRota: (aceito: boolean) =>
      chamar<void>('/me/consentimento-rota', { metodo: 'PUT', corpo: { aceito } }),
  },
  aparelhos: {
    criar: (b: { imei: string; marca: string; modelo: string }) =>
      chamar<void>('/aparelhos', { metodo: 'POST', corpo: b }),
    listar: () => chamar<AparelhoDto[]>('/aparelhos'),
  },
  contas: {
    catalogo: () => chamar<ContaCatalogo[]>('/contas/catalogo', { semAuth: true }),
    vincular: (catalogoId: string) => chamar<void>('/contas', { metodo: 'POST', corpo: { catalogoId } }),
    listar: () => chamar<ContaDto[]>('/contas'),
  },
  guardioes: {
    criarConvite: () => chamar<ConviteDto>('/guardioes/convites', { metodo: 'POST' }),
    aceitar: (codigo: string) => chamar<void>(`/guardioes/convites/${e(codigo)}/aceitar`, { metodo: 'POST' }),
    listar: () => chamar<GuardiaoDto[]>('/guardioes'),
    ordenar: (ordem: string[]) => chamar<void>('/guardioes/ordem', { metodo: 'PUT', corpo: { ordem } }),
  },
  chaveiros: {
    criar: (deviceId: string) => chamar<void>('/chaveiros', { metodo: 'POST', corpo: { deviceId } }),
    listar: () => chamar<ChaveiroDto[]>('/chaveiros'),
    comando: (deviceId: string, cmd: 'find' | 'ping' | 'resolve') =>
      chamar<void>(`/chaveiros/${e(deviceId)}/comandos`, { metodo: 'POST', corpo: { cmd } }),
  },
  rota: {
    enviarPontos: (p: PontoRota[]) => chamar<void>('/rota/pontos', { metodo: 'POST', corpo: p }),
    obter: (de: string, ate: string) => chamar<PontoRotaDto[]>(`/rota?de=${e(de)}&ate=${e(ate)}`),
  },
  ocorrencias: {
    gatilho: (origem: 'web' | 'guardiao', vitimaId?: string) =>
      chamar<{ ocorrenciaId: string }>('/ocorrencias/gatilho', { metodo: 'POST', corpo: { origem, vitimaId } }),
    listar: () => chamar<OcorrenciaDto[]>('/ocorrencias'),
    obter: (id: string) => chamar<OcorrenciaDto>(`/ocorrencias/${e(id)}`),
    momento: (id: string, b: { em: string; lat: number; lng: number }) =>
      chamar<void>(`/ocorrencias/${e(id)}/momento`, { metodo: 'POST', corpo: b }),
    bo: (id: string) => chamar<BoDto>(`/ocorrencias/${e(id)}/bo`),
    compartilharPolicia: (id: string) =>
      chamar<{ protocolo: string }>(`/ocorrencias/${e(id)}/compartilhar-policia`, {
        metodo: 'POST',
        corpo: { consentimento: true },
      }),
    retorno: (id: string) => chamar<RetornoDto>(`/ocorrencias/${e(id)}/retorno`),
    acompanhamento: (id: string, b: { boNumero?: string; boStatus: BoStatus; recuperacao: Recuperacao }) =>
      chamar<void>(`/ocorrencias/${e(id)}/acompanhamento`, { metodo: 'PUT', corpo: b }),
    concluirPasso: (id: string, passo: Passo) =>
      chamar<void>(`/ocorrencias/${e(id)}/passos/${e(passo)}/concluir`, { metodo: 'POST' }),
  },
  alertas: {
    ativos: () => chamar<AlertaDto[]>('/alertas/ativos'),
    ciente: (alertaId: string) => chamar<void>(`/alertas/${e(alertaId)}/ciente`, { metodo: 'POST' }),
  },
  relatos: {
    criar: (b: RelatoNovo) => chamar<void>('/relatos', { metodo: 'POST', corpo: b }),
    confirmar: (id: string) => chamar<void>(`/relatos/${e(id)}/confirmar`, { metodo: 'POST' }),
    listar: (bbox: Bbox) => chamar<RelatoDto[]>(`/relatos?${q(bbox)}`),
  },
  risco: {
    consultar: (bbox: Bbox, dia: number, faixa: number) =>
      chamar<RiscoDto[]>(`/risco?${q(bbox)}&dia=${dia}&faixa=${faixa}`, { semAuth: true }),
  },
  camadas: {
    obter: (tipo: 'delegacias' | 'estacoes' | 'pm') =>
      chamar<CamadaPontoDto[]>(`/camadas/${tipo}`, { semAuth: true }),
  },
};
