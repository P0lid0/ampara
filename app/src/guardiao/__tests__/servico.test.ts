import notifee, { AndroidForegroundServiceType } from '@notifee/react-native';
import { definirToken } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { sair } from '../../auth/sessao';
import { API_URL } from '../../config';
import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';
import { criarHub, type OpcoesHub } from '../hub';
import { ESPERAS_NOVA_CONEXAO_MS, ID_NOTIFICACAO_SERVICO, iniciarServicoGuardiao, pararServicoGuardiao } from '../servico';
import { useAlarmes } from '../store';

jest.setTimeout(60000);

jest.mock('../hub', () => ({ criarHub: jest.fn() }));
jest.mock('../../api/endpoints', () => ({ api: { alertas: { ativos: jest.fn(), ciente: jest.fn() } } }));

// Registrado ao importar o módulo (escopo do módulo; imports sobem antes desta linha), antes de qualquer limpeza.
const registrosNoImport = jest.mocked(notifee.registerForegroundService).mock.calls.length;

const ativos = jest.mocked(api.alertas.ativos);
let opcoes: OpcoesHub;
const hub = { iniciar: jest.fn(), parar: jest.fn() };

// SINTETICO: dados de demonstração, nunca dado real.
const disparo = { alertaId: 'a1', ocorrenciaId: 'o1', vitimaNome: 'Pessoa Demo', origem: 'web', em: '2026-11-14T17:05:00Z' };

const ligarGuardiao = async () => sessaoRepo(await abrirBanco()).set('guardiao_ativo', '1');
const drenar = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(async () => {
  await pararServicoGuardiao();
  await sessaoRepo(await abrirBanco()).apagarTudo();
  jest.clearAllMocks();
  useAlarmes.getState().limpar();
  hub.iniciar.mockReset().mockResolvedValue(undefined);
  hub.parar.mockReset().mockResolvedValue(undefined);
  jest.mocked(criarHub).mockImplementation((o) => {
    opcoes = o;
    return hub;
  });
  ativos.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

it('registra o serviço em primeiro plano no escopo do módulo', () => {
  expect(registrosNoImport).toBe(1);
});

it('sem guardiao_ativo = "1" não sobe serviço nem conecta', async () => {
  await iniciarServicoGuardiao();
  expect(notifee.displayNotification).not.toHaveBeenCalled();
  expect(criarHub).not.toHaveBeenCalled();
});

it('com guardiao_ativo sobe a notificação do serviço (dataSync) e conecta o hub na API', async () => {
  await ligarGuardiao();
  definirToken('tok-teste');
  await iniciarServicoGuardiao();
  const n = jest.mocked(notifee.displayNotification).mock.calls[0][0];
  expect(n.id).toBe(ID_NOTIFICACAO_SERVICO);
  expect(n.title).toBe('Ampara está de olho: você é guardião');
  expect(n.android).toMatchObject({
    channelId: 'ampara-servico',
    asForegroundService: true,
    foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
  });
  expect(opcoes.baseUrl).toBe(API_URL);
  expect(opcoes.obterToken()).toBe('tok-teste');
  expect(hub.iniciar).toHaveBeenCalledTimes(1);
  // ao conectar busca os ativos (alerta disparado com o app fechado)
  expect(ativos).toHaveBeenCalledTimes(1);
  definirToken(null);
});

it('pede a permissão de notificação ao subir; negada não impede o serviço', async () => {
  jest.mocked(notifee.requestPermission).mockResolvedValueOnce({ authorizationStatus: 0 } as never);
  await ligarGuardiao();
  await iniciarServicoGuardiao();
  expect(notifee.requestPermission).toHaveBeenCalledTimes(1);
  expect(criarHub).toHaveBeenCalledTimes(1);
});

it('parar enquanto o serviço sobe derruba o serviço e não cria o hub', async () => {
  await ligarGuardiao();
  let liberar: () => void = () => undefined;
  jest.mocked(notifee.displayNotification).mockImplementationOnce(() => new Promise<string>((r) => (liberar = () => r('x'))));
  const subindo = iniciarServicoGuardiao();
  await drenar();
  await pararServicoGuardiao();
  jest.mocked(notifee.stopForegroundService).mockClear();
  liberar();
  await subindo;
  expect(criarHub).not.toHaveBeenCalled();
  expect(notifee.stopForegroundService).toHaveBeenCalled();
});

it('login logo depois do logout não reaproveita o início velho: o novo sobe com hub', async () => {
  await ligarGuardiao();
  let liberar: () => void = () => undefined;
  jest.mocked(notifee.displayNotification).mockImplementationOnce(() => new Promise<string>((r) => (liberar = () => r('x'))));
  const velho = iniciarServicoGuardiao();
  await drenar();
  await pararServicoGuardiao();
  const novo = iniciarServicoGuardiao();
  liberar();
  await Promise.all([velho, novo]);
  expect(criarHub).toHaveBeenCalledTimes(1);
});

it('chamar de novo com o serviço no ar não abre outra conexão', async () => {
  await ligarGuardiao();
  await Promise.all([iniciarServicoGuardiao(), iniciarServicoGuardiao()]);
  await iniciarServicoGuardiao();
  expect(criarHub).toHaveBeenCalledTimes(1);
});

describe('efeitos do hub', () => {
  beforeEach(async () => {
    await ligarGuardiao();
    await iniciarServicoGuardiao();
    jest.mocked(notifee.displayNotification).mockClear();
    ativos.mockClear();
  });

  it('AlertaDisparado toca (exibirAlarme com id = alertaId) uma vez só', async () => {
    opcoes.aoEvento({ tipo: 'AlertaDisparado', dado: disparo });
    opcoes.aoEvento({ tipo: 'AlertaDisparado', dado: disparo });
    await drenar();
    const ids = jest.mocked(notifee.displayNotification).mock.calls.map((c) => c[0].id);
    expect(ids).toEqual(['a1']);
    expect(useAlarmes.getState().estado.ativos.a1).toBeDefined();
  });

  it('AlertaEncerrado para (cancelarAlarme)', async () => {
    opcoes.aoEvento({ tipo: 'AlertaDisparado', dado: disparo });
    opcoes.aoEvento({ tipo: 'AlertaEncerrado', dado: { alertaId: 'a1', motivo: 'cancelado' } });
    await drenar();
    expect(notifee.cancelNotification).toHaveBeenCalledWith('a1');
  });

  it('AlertaEscalado desconhecido busca os ativos e toca o que veio', async () => {
    ativos.mockResolvedValue([disparo]);
    opcoes.aoEvento({ tipo: 'AlertaEscalado', dado: { alertaId: 'a1', ocorrenciaId: 'o1', paraGuardiaoId: 'g2', em: disparo.em } });
    await drenar();
    expect(ativos).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifee.displayNotification).mock.calls.map((c) => c[0].id)).toEqual(['a1']);
  });

  it('aoReconectar busca os ativos', async () => {
    opcoes.aoReconectar();
    await drenar();
    expect(ativos).toHaveBeenCalledTimes(1);
  });

  it('falha ao buscar ativos não derruba o serviço', async () => {
    ativos.mockRejectedValue(new Error('sem rede'));
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    opcoes.aoReconectar();
    await drenar();
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

it('hub que não conecta tenta de novo depois de 2 s', async () => {
  jest.useFakeTimers();
  hub.iniciar.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValue(undefined);
  await ligarGuardiao();
  await iniciarServicoGuardiao();
  expect(hub.iniciar).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(ESPERAS_NOVA_CONEXAO_MS[0]);
  await drenar();
  expect(hub.iniciar).toHaveBeenCalledTimes(2);
  expect(ativos).toHaveBeenCalledTimes(1);
});

it('hub desconectado de vez (onclose) reconecta', async () => {
  jest.useFakeTimers();
  await ligarGuardiao();
  await iniciarServicoGuardiao();
  opcoes.aoEstado('desconectado');
  jest.advanceTimersByTime(ESPERAS_NOVA_CONEXAO_MS[0]);
  await drenar();
  expect(hub.iniciar).toHaveBeenCalledTimes(2);
});

it('pararServicoGuardiao fecha o hub, derruba o serviço, cala os alarmes e limpa o store', async () => {
  await ligarGuardiao();
  await iniciarServicoGuardiao();
  opcoes.aoEvento({ tipo: 'AlertaDisparado', dado: disparo });
  await drenar();
  await pararServicoGuardiao();
  expect(hub.parar).toHaveBeenCalled();
  expect(notifee.stopForegroundService).toHaveBeenCalled();
  expect(notifee.cancelNotification).toHaveBeenCalledWith('a1');
  expect(useAlarmes.getState().estado.ativos).toEqual({});
  // não reconecta depois de parado
  opcoes.aoEstado('desconectado');
  expect(criarHub).toHaveBeenCalledTimes(1);
});

it('sair() (logout) para o serviço do guardião', async () => {
  await ligarGuardiao();
  await iniciarServicoGuardiao();
  await sair('manual');
  await drenar();
  expect(hub.parar).toHaveBeenCalled();
  expect(notifee.stopForegroundService).toHaveBeenCalled();
});
