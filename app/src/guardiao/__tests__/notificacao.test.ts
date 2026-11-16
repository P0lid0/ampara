import notifee, { AndroidCategory, AndroidImportance, AndroidVisibility, AuthorizationStatus } from '@notifee/react-native';
import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';
import type { AlertaAtivo } from '../alarmeEstado';
import {
  CANAL_ALARME,
  CANAL_SERVICO,
  cancelarAlarme,
  criarCanais,
  exibirAlarme,
  horaLocal,
  marcarAlarmeEmTela,
  permissaoNotificacao,
  rotuloOrigem,
} from '../notificacao';

jest.setTimeout(60000);

// SINTETICO: nome de demonstração, nunca dado real.
const alerta: AlertaAtivo = {
  alertaId: 'a1',
  ocorrenciaId: 'o1',
  vitimaNome: 'Pessoa Demo',
  origem: 'chaveiro',
  em: '2026-11-14T17:05:00Z',
  cienteEnviado: false,
};

const exibida = () => jest.mocked(notifee.displayNotification).mock.calls.at(-1)![0];

beforeEach(async () => {
  jest.clearAllMocks();
  await sessaoRepo(await abrirBanco()).apagarTudo();
});

describe('canais', () => {
  it('criarCanais cria o de alarme (HIGH, vibração, som, bypassDnd, público) e o de serviço (LOW)', async () => {
    await criarCanais();
    const canais = jest.mocked(notifee.createChannel).mock.calls.map((c) => c[0]);
    const alarme = canais.find((c) => c.id === CANAL_ALARME)!;
    expect(CANAL_ALARME).toBe('ampara-alarme');
    expect(alarme).toMatchObject({
      importance: AndroidImportance.HIGH,
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      sound: 'default',
      bypassDnd: true,
      visibility: AndroidVisibility.PUBLIC,
    });
    const servico = canais.find((c) => c.id === CANAL_SERVICO)!;
    expect(CANAL_SERVICO).toBe('ampara-servico');
    expect(servico.importance).toBe(AndroidImportance.LOW);
  });
});

describe('exibirAlarme', () => {
  it('exibirAlarme usa canal ampara-alarme, categoria ALARM, ongoing e fullScreenAction', async () => {
    await exibirAlarme(alerta, { telaCheia: true });
    const n = exibida();
    expect(n.id).toBe('a1');
    expect(n.title).toBe('Alerta: Pessoa Demo precisa de ajuda');
    expect(n.body).toContain('Chaveiro');
    expect(n.body).toContain('14:05');
    expect(n.android).toMatchObject({
      channelId: 'ampara-alarme',
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      loopSound: true,
      ongoing: true,
      autoCancel: false,
    });
    expect(n.android!.fullScreenAction).toEqual({ id: 'default', launchActivity: 'default' });
    expect(n.data).toEqual({ alertaId: 'a1' });
  });

  it('exibirAlarme com telaCheia=false (plano B) não envia fullScreenAction mas mantém importância HIGH, vibração e loopSound', async () => {
    await exibirAlarme(alerta, { telaCheia: false });
    const n = exibida();
    expect(n.android!.fullScreenAction).toBeUndefined();
    expect(n.android).toMatchObject({
      channelId: 'ampara-alarme',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [300, 500, 300, 500],
      loopSound: true,
      ongoing: true,
    });
  });

  it('sem opção, lê sessao.alarme_plano_b: ligado tira a tela cheia; desligado mantém', async () => {
    await exibirAlarme(alerta);
    expect(exibida().android!.fullScreenAction).toBeDefined();
    await sessaoRepo(await abrirBanco()).set('alarme_plano_b', '1');
    await exibirAlarme(alerta);
    expect(exibida().android!.fullScreenAction).toBeUndefined();
  });

  it('garante os canais antes de exibir (uma vez por processo)', async () => {
    await jest.isolateModulesAsync(async () => {
      const n = jest.requireMock('@notifee/react-native').default as typeof notifee;
      const m = require('../notificacao') as typeof import('../notificacao');
      await m.exibirAlarme(alerta, { telaCheia: true });
      await m.exibirAlarme(alerta, { telaCheia: true });
      const alarmes = jest.mocked(n.createChannel).mock.calls.filter((c) => c[0].id === CANAL_ALARME);
      expect(alarmes).toHaveLength(1);
      expect(jest.mocked(n.createChannel).mock.invocationCallOrder[0]).toBeLessThan(
        jest.mocked(n.displayNotification).mock.invocationCallOrder[0],
      );
    });
  });

  it('não exibe a notificação de um alerta com a tela de alarme aberta', async () => {
    marcarAlarmeEmTela('a1', true);
    await exibirAlarme(alerta, { telaCheia: true });
    expect(notifee.displayNotification).not.toHaveBeenCalled();
    marcarAlarmeEmTela('a1', false);
    await exibirAlarme(alerta, { telaCheia: true });
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
  });
});

it('cancelarAlarme cancela a notificação pelo alertaId', async () => {
  await cancelarAlarme('a1');
  expect(notifee.cancelNotification).toHaveBeenCalledWith('a1');
});

describe('permissaoNotificacao', () => {
  it('autorizada devolve ok; negada devolve negada', async () => {
    expect(await permissaoNotificacao()).toBe('ok');
    jest.mocked(notifee.requestPermission).mockResolvedValueOnce({
      authorizationStatus: AuthorizationStatus.DENIED,
    } as never);
    expect(await permissaoNotificacao()).toBe('negada');
  });

  it('com pedir=false só consulta (não abre o pedido do sistema)', async () => {
    jest.mocked(notifee.getNotificationSettings).mockResolvedValueOnce({
      authorizationStatus: AuthorizationStatus.DENIED,
    } as never);
    expect(await permissaoNotificacao(false)).toBe('negada');
    expect(notifee.requestPermission).not.toHaveBeenCalled();
  });
});

describe('textos', () => {
  it('rotuloOrigem em português', () => {
    expect(rotuloOrigem('chaveiro')).toBe('Chaveiro');
    expect(rotuloOrigem('web')).toBe('Página de emergência');
    expect(rotuloOrigem('guardiao')).toBe('Outro guardião');
  });
  it('horaLocal no fuso America/Sao_Paulo e vazio para data inválida', () => {
    expect(horaLocal('2026-11-14T17:05:00Z')).toBe('14:05');
    expect(horaLocal('não é data')).toBe('');
  });
});
