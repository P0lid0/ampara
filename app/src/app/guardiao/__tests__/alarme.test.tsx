import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, StyleSheet, Vibration } from 'react-native';
import Alarme from '../alarme';
import { ApiErro } from '../../../api/cliente';
import { api } from '../../../api/endpoints';
import { useAlarmes } from '../../../guardiao/store';
import { useRedirecionarParaAlarme } from '../../../guardiao/redirecionar';

jest.setTimeout(60000);

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../../api/endpoints', () => ({ api: { alertas: { ciente: jest.fn(), ativos: jest.fn() } } }));

const ciente = jest.mocked(api.alertas.ciente);
const FRASE = 'Alerta. Pessoa Demo precisa de ajuda. Toque em Estou ciente para avisar que você vai ajudar.';

// Tocador estável (o mock padrão cria um novo a cada render).
const tocador = { play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(), replace: jest.fn(), loop: false, volume: 1, playing: false };

// SINTETICO: nome de demonstração, nunca dado real.
async function disparar(alertaId = 'a1', em = '2026-11-14T17:05:00Z') {
  await act(async () => {
    useAlarmes.getState().aplicar({
      tipo: 'AlertaDisparado',
      dado: { alertaId, ocorrenciaId: `oc-${alertaId}`, vitimaNome: 'Pessoa Demo', origem: 'chaveiro', em },
    });
  });
}

/** Deixa as promessas pendentes resolverem (com relógio falso). */
async function drenar() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function avancar(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await drenar();
}

let anunciar: jest.SpyInstance;
let vibrar: jest.SpyInstance;
let cancelarVibracao: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  // o mock do AppState no jest traz currentState como função; no aparelho é o texto 'active'
  (AppState as unknown as { currentState: string }).currentState = 'active';
  useAlarmes.getState().limpar();
  mockReplace.mockReset();
  mockPush.mockReset();
  mockParams = { alertaId: 'a1' };
  ciente.mockReset().mockResolvedValue(undefined);
  Object.values(tocador).forEach((v) => typeof v === 'function' && (v as jest.Mock).mockClear());
  const { useAudioPlayer } = jest.requireMock('expo-audio') as { useAudioPlayer: jest.Mock };
  useAudioPlayer.mockReturnValue(tocador);
  anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  vibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
  cancelarVibracao = jest.spyOn(Vibration, 'cancel').mockImplementation(() => undefined);
  jest.mocked(notifee.getNotificationSettings).mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED } as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('tela de alarme', () => {
  it('ao montar, announceForAccessibility é chamado com "Alerta. Pessoa Demo precisa de ajuda. Toque em Estou ciente para avisar que você vai ajudar." e repete a cada 10 s', async () => {
    await disparar();
    await render(<Alarme />);
    await drenar();
    expect(anunciar).toHaveBeenCalledTimes(1);
    expect(anunciar).toHaveBeenLastCalledWith(FRASE);
    await avancar(10000);
    expect(anunciar).toHaveBeenCalledTimes(2);
    await avancar(10000);
    expect(anunciar).toHaveBeenCalledTimes(3);
    // título, origem em português e hora local
    expect(screen.getByText('Pessoa Demo precisa de ajuda')).toBeTruthy();
    expect(screen.getByText('Toque em Estou ciente para avisar que você vai ajudar.')).toBeTruthy();
    expect(screen.getByText('Origem do aviso: Chaveiro.')).toBeTruthy();
    expect(screen.getByText('Às 14:05')).toBeTruthy();
    expect(screen.getByText('Ampara')).toBeTruthy();
    // sirene em loop e vibração repetida
    expect(tocador.play).toHaveBeenCalled();
    expect(tocador.loop).toBe(true);
    expect(vibrar).toHaveBeenCalledWith([0, 500, 300, 500], true);
  });

  it('o botão "Estou ciente" tem 64 dp, role button, fica na base fora do ScrollView, e o conteúdo rola (fonte 200% não corta o botão)', async () => {
    await disparar();
    await render(<Alarme />);
    const tela = screen.getByTestId('tela-alarme');
    expect(tela.type).toBe('RCTScrollView');
    const botao = screen.getByRole('button', { name: 'Estou ciente' });
    expect(within(tela).queryByRole('button', { name: 'Estou ciente' })).toBeNull();
    expect(StyleSheet.flatten(botao.props.style).minHeight).toBeGreaterThanOrEqual(64);
    expect(screen.getByText('O botão voltar fica travado até você confirmar.')).toBeTruthy();
  });

  it('o toque em "Estou ciente" dá uma batida forte de háptica depois de calar a sirene', async () => {
    const Haptics = jest.requireMock('expo-haptics') as { impactAsync: jest.Mock };
    Haptics.impactAsync.mockClear();
    await disparar();
    await render(<Alarme />);
    await fireEvent.press(screen.getByRole('button', { name: 'Estou ciente' }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
    expect(tocador.pause).toHaveBeenCalled();
  });

  it('RF3: toque duplo em "Estou ciente" chama api.alertas.ciente UMA vez', async () => {
    let concluir: () => void = () => undefined;
    ciente.mockImplementation(() => new Promise<void>((r) => (concluir = r)));
    await disparar();
    await render(<Alarme />);
    const botao = screen.getByRole('button', { name: 'Estou ciente' });
    // dois toques antes de qualquer re-renderização: só a trava (e não o botão sumir) barra o segundo
    const aoTocar = botao.props.onClick as () => void;
    await act(async () => {
      aoTocar();
      aoTocar();
    });
    expect(ciente).toHaveBeenCalledTimes(1);
    expect(ciente).toHaveBeenCalledWith('a1');
    await act(async () => concluir());
  });

  it('RF3: ciente com rede caindo: para sirene e vibração na hora, mostra "Enviando sua confirmação…" e repete em 2 s, 4 s, 8 s até 204; depois navega para guardiao/passo-a-passo?ocorrenciaId=…', async () => {
    const semRede = new ApiErro(0, 'sem rede', undefined, 'sem rede');
    ciente.mockRejectedValueOnce(semRede).mockRejectedValueOnce(semRede).mockRejectedValueOnce(semRede).mockResolvedValue(undefined);
    await disparar();
    await render(<Alarme />);
    await drenar();
    await fireEvent.press(screen.getByRole('button', { name: 'Estou ciente' }));
    expect(tocador.pause).toHaveBeenCalled();
    expect(cancelarVibracao).toHaveBeenCalled();
    await drenar();
    expect(screen.getByText('Enviando sua confirmação…')).toBeTruthy();
    expect(ciente).toHaveBeenCalledTimes(1);

    await avancar(1999);
    expect(ciente).toHaveBeenCalledTimes(1);
    await avancar(1);
    expect(ciente).toHaveBeenCalledTimes(2);
    await avancar(4000);
    expect(ciente).toHaveBeenCalledTimes(3);
    expect(mockReplace).not.toHaveBeenCalled();
    await avancar(8000);
    expect(ciente).toHaveBeenCalledTimes(4);
    expect(mockReplace).toHaveBeenCalledWith('/guardiao/passo-a-passo?ocorrenciaId=oc-a1');
    expect(useAlarmes.getState().estado.ativos.a1.cienteEnviado).toBe(true);
    // a sirene não volta a tocar durante as novas tentativas
    expect(tocador.play).toHaveBeenCalledTimes(1);
  });

  it('modo demonstração: alerta de ocorrência demo-… confirma sem chamar a API (funciona sem internet) e vai ao passo a passo', async () => {
    ciente.mockRejectedValue(new ApiErro(0, 'Sem conexão.'));
    await act(async () => {
      useAlarmes.getState().aplicar({
        tipo: 'AlertaDisparado',
        dado: { alertaId: 'a1', ocorrenciaId: 'demo-a1', vitimaNome: 'Pessoa Demo', origem: 'chaveiro', em: '2026-11-14T17:05:00Z' },
      });
    });
    await render(<Alarme />);
    await fireEvent.press(screen.getByRole('button', { name: 'Estou ciente' }));
    await drenar();
    expect(ciente).not.toHaveBeenCalled();
    expect(useAlarmes.getState().estado.ativos.a1?.cienteEnviado).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/guardiao/passo-a-passo?ocorrenciaId=demo-a1');
  });

  it('erro 4xx no ciente não fica repetindo e oferece tentar de novo', async () => {
    ciente.mockRejectedValueOnce(new ApiErro(403, 'proibido', undefined, 'Você não é guardião deste alerta.'));
    await disparar();
    await render(<Alarme />);
    await fireEvent.press(screen.getByRole('button', { name: 'Estou ciente' }));
    await drenar();
    await avancar(10000);
    expect(ciente).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Você não é guardião deste alerta/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    await drenar();
    expect(ciente).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith('/guardiao/passo-a-passo?ocorrenciaId=oc-a1');
  });

  it('RF3: AlertaEncerrado (motivo cancelado) com a tela aberta para a sirene e mostra "Alerta cancelado. Você não precisa agir."', async () => {
    await disparar();
    await render(<Alarme />);
    await drenar();
    await act(async () => {
      useAlarmes.getState().aplicar({ tipo: 'AlertaEncerrado', dado: { alertaId: 'a1', motivo: 'cancelado' } });
    });
    await drenar();
    expect(tocador.pause).toHaveBeenCalled();
    expect(cancelarVibracao).toHaveBeenCalled();
    expect(screen.getByText('Alerta cancelado. Você não precisa agir.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Estou ciente' })).toBeNull();
    // para de anunciar
    const antes = anunciar.mock.calls.length;
    await avancar(30000);
    expect(anunciar.mock.calls.length).toBe(antes);
  });

  it('408 e 429 no ciente são transitórios: repete em vez de parar no erro', async () => {
    ciente.mockRejectedValueOnce(new ApiErro(429, 'muitas', undefined, 'x')).mockResolvedValue(undefined);
    await disparar();
    await render(<Alarme />);
    await fireEvent.press(screen.getByRole('button', { name: 'Estou ciente' }));
    await drenar();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    await avancar(2000);
    expect(ciente).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith('/guardiao/passo-a-passo?ocorrenciaId=oc-a1');
  });

  it('AlertaEncerrado com motivo "ciente" disparado por outro guardião para a sirene e mostra "Outro guardião já assumiu. Você não precisa agir."', async () => {
    await disparar();
    await render(<Alarme />);
    await drenar();
    await act(async () => {
      useAlarmes.getState().aplicar({ tipo: 'AlertaEncerrado', dado: { alertaId: 'a1', motivo: 'ciente' } });
    });
    await drenar();
    expect(tocador.pause).toHaveBeenCalled();
    expect(screen.getByText('Outro guardião já assumiu. Você não precisa agir.')).toBeTruthy();
  });

  it('RF4: sem permissão de notificação, o BannerAlarme aparece com "Alarme desativado: permita notificações em Ajustes."', async () => {
    jest.mocked(notifee.getNotificationSettings).mockResolvedValue({ authorizationStatus: AuthorizationStatus.DENIED } as never);
    await disparar();
    await render(<Alarme />);
    await drenar();
    expect(screen.getByText('Alarme desativado: permita notificações em Ajustes.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir Ajustes' }));
    expect(notifee.openNotificationSettings).toHaveBeenCalled();
  });

  it('com permissão, o BannerAlarme não aparece', async () => {
    await disparar();
    await render(<Alarme />);
    await drenar();
    expect(screen.queryByText('Alarme desativado: permita notificações em Ajustes.')).toBeNull();
  });
});

describe('tela de alarme e o estado do app', () => {
  let mudar: (e: string) => void;
  const definirEstado = (e: string) => {
    (AppState as unknown as { currentState: string }).currentState = e;
  };

  beforeEach(() => {
    mudar = () => undefined;
    definirEstado('active');
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (e: string) => void) => {
      mudar = (e) => {
        definirEstado(e);
        cb(e);
      };
      return { remove: jest.fn() };
    }) as never);
    vibrar.mockClear();
    jest.mocked(notifee.cancelNotification).mockClear();
    jest.mocked(notifee.displayNotification).mockClear();
  });

  afterEach(() => definirEstado('active'));

  it('em primeiro plano assume o alerta: cancela a notificação e toca a sirene da tela', async () => {
    await disparar();
    await render(<Alarme />);
    await drenar();
    expect(notifee.cancelNotification).toHaveBeenCalledWith('a1');
    expect(tocador.play).toHaveBeenCalled();
  });

  it('montada em segundo plano não cancela a notificação nem toca a sirene da tela', async () => {
    definirEstado('background');
    await disparar();
    await render(<Alarme />);
    await drenar();
    expect(notifee.cancelNotification).not.toHaveBeenCalled();
    expect(tocador.play).not.toHaveBeenCalled();
    expect(vibrar).not.toHaveBeenCalledWith([0, 500, 300, 500], true);
    expect(screen.getByRole('button', { name: 'Estou ciente' })).toBeTruthy();
  });

  it('ao voltar para o primeiro plano a tela assume; ao ir para o segundo, a notificação volta', async () => {
    definirEstado('background');
    await disparar();
    await render(<Alarme />);
    await drenar();
    await act(async () => mudar('active'));
    await drenar();
    expect(notifee.cancelNotification).toHaveBeenCalledWith('a1');
    expect(tocador.play).toHaveBeenCalledTimes(1);

    await act(async () => mudar('background'));
    await drenar();
    expect(tocador.pause).toHaveBeenCalled();
    expect(jest.mocked(notifee.displayNotification).mock.calls.map((c) => c[0].id)).toEqual(['a1']);
  });

  it('sair da tela sem o ciente devolve a notificação', async () => {
    await disparar();
    const { unmount } = await render(<Alarme />);
    await drenar();
    await unmount();
    await drenar();
    expect(jest.mocked(notifee.displayNotification).mock.calls.map((c) => c[0].id)).toEqual(['a1']);
  });
});

describe('useRedirecionarParaAlarme', () => {
  it('useRedirecionarParaAlarme navega 1 vez por alertaId (não de novo se o mesmo continua em destaque)', async () => {
    const router = { push: jest.fn() };
    await renderHook(() => useRedirecionarParaAlarme(useAlarmes, router));
    expect(router.push).not.toHaveBeenCalled();

    await disparar('a1', '2026-11-14T17:05:00Z');
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenLastCalledWith('/guardiao/alarme?alertaId=a1');

    // outro alerta mais novo não tira o a1 do destaque; nada novo
    await disparar('a2', '2026-11-14T17:06:00Z');
    expect(router.push).toHaveBeenCalledTimes(1);

    // ciente no a1: o a2 passa ao destaque e navega uma vez
    await act(async () => useAlarmes.getState().marcarCienteEnviado('a1'));
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith('/guardiao/alarme?alertaId=a2');

    // o a2 encerrado e reaparecendo como ativo não acontece; mudanças sem novo destaque não navegam
    await act(async () => {
      useAlarmes.getState().aplicar({ tipo: 'AlertaEncerrado', dado: { alertaId: 'a2', motivo: 'cancelado' } });
    });
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it('desabilitado não navega; ao habilitar navega para o destaque atual', async () => {
    const router = { push: jest.fn() };
    await disparar('a1');
    const { rerender } = await renderHook(({ ok }: { ok: boolean }) => useRedirecionarParaAlarme(useAlarmes, router, ok), {
      initialProps: { ok: false },
    });
    expect(router.push).not.toHaveBeenCalled();
    await rerender({ ok: true });
    expect(router.push).toHaveBeenCalledWith('/guardiao/alarme?alertaId=a1');
  });
});
