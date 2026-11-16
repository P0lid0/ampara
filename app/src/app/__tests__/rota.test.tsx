import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import Rota from '../rota';
import { ApiErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { OcorrenciaDto } from '../../api/tipos';

jest.setTimeout(60000);

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
let mockEscopo: 'usuario' | 'emergencia' | null = 'usuario';
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../auth/sessao', () => ({ useSessao: () => ({ escopo: mockEscopo }) }));
jest.mock('../../api/endpoints', () => ({
  api: {
    rota: { obter: jest.fn() },
    ocorrencias: { listar: jest.fn(), momento: jest.fn(), gatilho: jest.fn() },
  },
}));

const obterRota = jest.mocked(api.rota.obter);
const listar = jest.mocked(api.ocorrencias.listar);
const momento = jest.mocked(api.ocorrencias.momento);
const gatilho = jest.mocked(api.ocorrencias.gatilho);

const NOW = new Date('2026-11-14T15:00:00Z');
// SINTETICO: três pontos no dia 12 (17:41, 17:50 e 18:10 em São Paulo) e um no dia 13.
const PONTOS = [
  { lat: -23.5, lng: -46.6, em: '2026-11-12T20:41:00Z' },
  { lat: -23.51, lng: -46.61, em: '2026-11-12T20:50:00Z' },
  { lat: -23.52, lng: -46.62, em: '2026-11-12T21:10:00Z' },
  { lat: -23.6, lng: -46.7, em: '2026-11-13T13:00:00Z' },
];
const oc = (id: string, iniciadaEm: string): OcorrenciaDto => ({
  id,
  estado: 'Aberta',
  origem: 'app',
  iniciadaEm,
  momento: null,
  passos: [],
  alertas: [],
  contas: [],
});

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  mockParams = { ocorrenciaId: 'oc-1' };
  mockEscopo = 'usuario';
  mockPush.mockReset();
  obterRota.mockReset().mockResolvedValue(PONTOS);
  listar.mockReset().mockResolvedValue([]);
  momento.mockReset().mockResolvedValue(undefined);
  gatilho.mockReset().mockResolvedValue({ ocorrenciaId: 'oc-novo' });
});
afterEach(() => jest.useRealTimers());

async function abrirDia12() {
  await render(<Rota />);
  await fireEvent.press(await screen.findByLabelText('Dia qui 12'));
}

describe('tela da rota', () => {
  it('pede a rota dos últimos 7 dias em UTC', async () => {
    await render(<Rota />);
    await screen.findByLabelText('Dia qui 12');
    expect(obterRota).toHaveBeenCalledWith('2026-11-07T15:00:00.000Z', '2026-11-14T15:00:00.000Z');
  });

  it('rota vazia mostra a orientação e não mostra o botão de marcar', async () => {
    obterRota.mockResolvedValue([]);
    await render(<Rota />);
    expect(
      await screen.findByText('Nenhuma rota nos últimos 7 dias. Confira se a rota está ligada em Ajustes.'),
    ).toBeTruthy();
    expect(screen.queryByText('Foi aqui que me roubaram')).toBeNull();
  });

  it('os dias aparecem como botões "qui 12"', async () => {
    await render(<Rota />);
    expect(await screen.findByText('qui 12')).toBeTruthy();
    expect(screen.getByText('sex 13')).toBeTruthy();
  });

  it('há uma lista de horários alternativa ao mapa, um item por ponto do dia, com "Às 17:41"', async () => {
    await abrirDia12();
    const lista = await screen.findByTestId('lista-horarios');
    for (const h of ['17:41', '17:50', '18:10']) {
      expect(within(lista).getByLabelText(`Às ${h}`)).toBeTruthy();
    }
    expect(within(lista).queryByLabelText('Às 10:00')).toBeNull();
  });

  it('o controle de horário tem o valor em texto', async () => {
    await abrirDia12();
    const slider = await screen.findByTestId('controle-horario');
    expect(slider.props.accessibilityValue?.text).toMatch(/^Às \d{2}:\d{2}$/);
  });

  it('escolher o 2º horário na lista e tocar "Foi aqui que me roubaram" chama momento com os valores desse ponto', async () => {
    await abrirDia12();
    await fireEvent.press(await screen.findByLabelText('Às 17:50'));
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(momento).toHaveBeenCalledTimes(1));
    expect(momento).toHaveBeenCalledWith('oc-1', { em: '2026-11-12T20:50:00Z', lat: -23.51, lng: -46.61 });
  });

  it('depois de marcar, navega para /bo?ocorrenciaId=…', async () => {
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/bo?ocorrenciaId=oc-1'));
  });

  it('sem ocorrenciaId usa a ocorrência mais recente do listar()', async () => {
    mockParams = {};
    listar.mockResolvedValue([
      oc('antiga', '2026-11-01T10:00:00Z'),
      oc('nova', '2026-11-12T22:00:00Z'),
      oc('meio', '2026-11-05T10:00:00Z'),
    ]);
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(momento).toHaveBeenCalledWith('nova', expect.anything()));
    expect(gatilho).not.toHaveBeenCalled();
  });

  it('modo emergência sem ocorrência abre uma pelo gatilho web (L9)', async () => {
    mockParams = {};
    mockEscopo = 'emergencia';
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(gatilho).toHaveBeenCalledWith('web'));
    await waitFor(() => expect(momento).toHaveBeenCalledWith('oc-novo', expect.anything()));
    expect(mockPush).toHaveBeenCalledWith('/bo?ocorrenciaId=oc-novo');
  });

  it('usuário comum sem ocorrência não dispara gatilho e avisa', async () => {
    mockParams = {};
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    expect(await screen.findByText(/Nenhuma ocorrência/)).toBeTruthy();
    expect(gatilho).not.toHaveBeenCalled();
    expect(momento).not.toHaveBeenCalled();
  });

  it('falha ao marcar mostra o erro, não navega e deixa tentar de novo', async () => {
    momento.mockRejectedValueOnce(new ApiErro(0, 'rede'));
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
  });

  it('emergência sem ocorrência: falha em momento e nova tentativa não abre segunda ocorrência', async () => {
    mockParams = {};
    mockEscopo = 'emergencia';
    momento.mockRejectedValueOnce(new ApiErro(0, 'rede'));
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/bo?ocorrenciaId=oc-novo'));
    expect(gatilho).toHaveBeenCalledTimes(1);
    expect(momento).toHaveBeenCalledTimes(2);
    expect(momento).toHaveBeenLastCalledWith('oc-novo', expect.anything());
  });

  it('emergência com erro de rede no listar não abre ocorrência', async () => {
    mockParams = {};
    mockEscopo = 'emergencia';
    listar.mockRejectedValueOnce(new ApiErro(0, 'rede'));
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(gatilho).not.toHaveBeenCalled();
  });

  it('emergência com listar negado (403) abre a ocorrência pelo gatilho', async () => {
    mockParams = {};
    mockEscopo = 'emergencia';
    listar.mockRejectedValueOnce(new ApiErro(403, 'negado'));
    await abrirDia12();
    await fireEvent.press(screen.getByText('Foi aqui que me roubaram'));
    await waitFor(() => expect(gatilho).toHaveBeenCalledWith('web'));
  });

  it('falha ao carregar a rota mostra o erro e permite tentar de novo', async () => {
    obterRota.mockRejectedValueOnce(new ApiErro(0, 'rede'));
    await render(<Rota />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByLabelText('Dia qui 12')).toBeTruthy();
  });
});
