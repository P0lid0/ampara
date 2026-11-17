import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import Mapa from '../(tabs)/mapa';
import { api } from '../../api/endpoints';
import type { RelatoDto, RiscoDto } from '../../api/tipos';

jest.setTimeout(60000);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('../../api/endpoints', () => ({
  api: {
    risco: { consultar: jest.fn() },
    relatos: { listar: jest.fn(), confirmar: jest.fn() },
    camadas: { obter: jest.fn() },
  },
}));

const consultar = jest.mocked(api.risco.consultar);
const listarRelatos = jest.mocked(api.relatos.listar);
const confirmar = jest.mocked(api.relatos.confirmar);
const obterCamada = jest.mocked(api.camadas.obter);

const NOW = new Date('2026-11-14T15:00:00Z');
// SINTETICO: células ao redor de Pinheiros.
const RISCO: RiscoDto[] = [
  { areaId: 'g051_026', lat: -23.5696, lng: -46.7019, classe: 'alto', probAlto: 0.8 },
  { areaId: 'g051_027', lat: -23.5696, lng: -46.697, classe: 'baixo', probAlto: 0.02 },
];
const relato = (id: string, minAtras: number): RelatoDto => ({
  id,
  tipo: 'roubo',
  lat: -23.5696,
  lng: -46.7019,
  em: new Date(NOW.getTime() - minAtras * 60000).toISOString(),
  confirmacoes: 1,
});

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  consultar.mockReset().mockResolvedValue(RISCO);
  listarRelatos.mockReset().mockResolvedValue([]);
  confirmar.mockReset().mockResolvedValue(undefined);
  obterCamada.mockReset().mockResolvedValue([{ nome: '1º DP Sintético', lat: -23.57, lng: -46.7 }]);
});
afterEach(() => jest.useRealTimers());

const poligonos = (): { areaId: string; classe: string }[] => {
  const fonte = screen.queryAllByTestId('maplibre-GeoJSONSource').find((n) => n.props.id === 'risco-fonte');
  return (fonte?.props.data.features ?? []).map((f: { properties: { areaId: string; classe: string } }) => f.properties);
};

describe('aba Mapa', () => {
  it('legenda com os 3 níveis em texto, mais "Sem dado", e lista "Áreas com atenção máxima agora"', async () => {
    await render(<Mapa />);
    await screen.findByText('Áreas com atenção máxima agora');
    expect(screen.getByText('Atenção normal')).toBeTruthy();
    expect(screen.getByText('Atenção redobrada')).toBeTruthy();
    expect(screen.getAllByText('Atenção máxima neste horário').length).toBeGreaterThan(0);
    expect(screen.getByText('Sem dado para esta área')).toBeTruthy();
    expect(await screen.findByText('Atenção máxima perto de -23.5696, -46.7019')).toBeTruthy();
    expect(screen.queryByText(/-46\.6970/)).toBeNull(); // baixo não entra
  });

  it('consulta o risco com o dia e a faixa de agora (sábado 12:00 em São Paulo: dia 5, faixa 4)', async () => {
    await render(<Mapa />);
    await waitFor(() => expect(consultar).toHaveBeenCalled());
    const [bbox, dia, faixa] = consultar.mock.calls[0];
    expect(dia).toBe(5);
    expect(faixa).toBe(4);
    expect(bbox.minLat).toBeLessThan(bbox.maxLat);
  });

  it('sem permissão de localização centraliza em Pinheiros e avisa', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      granted: false, status: 'denied', canAskAgain: true, expires: 'never',
    } as never);
    await render(<Mapa />);
    expect(await screen.findByText(/Sem permissão de localização/)).toBeTruthy();
    await waitFor(() => expect(consultar).toHaveBeenCalled());
    const bbox = consultar.mock.calls[0][0];
    expect((bbox.minLat + bbox.maxLat) / 2).toBeCloseTo(-23.567249, 3);
    expect((bbox.minLng + bbox.maxLng) / 2).toBeCloseTo(-46.7019515, 3);
  });

  it('localização fora da capital (emulador na Califórnia) centraliza em Pinheiros e avisa', async () => {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValueOnce({
      coords: { latitude: 37.422, longitude: -122.084 },
    } as never);
    await render(<Mapa />);
    expect(
      await screen.findByText('Você está fora da cidade de São Paulo, onde há dados: mostrando a região de Pinheiros.'),
    ).toBeTruthy();
    await waitFor(() => expect(consultar).toHaveBeenCalled());
    const bbox = consultar.mock.calls[0][0];
    expect((bbox.minLat + bbox.maxLat) / 2).toBeCloseTo(-23.567249, 3);
    expect((bbox.minLng + bbox.maxLng) / 2).toBeCloseTo(-46.7019515, 3);
  });

  it('mover o mapa consulta de novo só depois de 500 ms parado (debounce)', async () => {
    await render(<Mapa />);
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
    const mapa = screen.getByTestId('maplibre-Map');
    const mover = (w: number) =>
      mapa.props.onRegionDidChange({ nativeEvent: { bounds: [w, -23.6, w + 0.05, -23.5] } });
    await act(async () => {
      mover(-46.8);
      mover(-46.7);
    });
    expect(consultar).toHaveBeenCalledTimes(1);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
    expect(consultar.mock.calls[1][0].minLng).toBeCloseTo(-46.7, 5);
  });

  it('falha no risco avisa em texto e não derruba a tela', async () => {
    consultar.mockRejectedValue(new Error('rede'));
    await render(<Mapa />);
    expect(await screen.findByText('Não deu para carregar o risco agora.')).toBeTruthy();
    expect(screen.getByText('Sem dado para esta área')).toBeTruthy();
    // falha de rede não desenha nenhuma célula (nem 'sem'): não afirmar "sem dado" sem saber
    await waitFor(() => expect(poligonos()).toEqual([]));
  });

  it('falha no risco oferece "Tentar de novo", que consulta outra vez e limpa o aviso', async () => {
    consultar.mockRejectedValueOnce(new Error('rede'));
    await render(<Mapa />);
    await screen.findByText('Não deu para carregar o risco agora.');
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByText('Não deu para carregar o risco agora.')).toBeNull());
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Atenção máxima perto de -23.5696, -46.7019')).toBeTruthy();
  });

  it('release (Hermes): com o Intl sem as partes de data, pede o risco com dia 0..6 e faixa 0..7 e não mostra erro', async () => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function () {
      return { formatToParts: () => [], format: () => '' };
    } as never;
    try {
      await render(<Mapa />);
      await waitFor(() => expect(consultar).toHaveBeenCalled());
      const [, dia, faixa] = consultar.mock.calls[0];
      expect([dia, faixa]).toEqual([5, 4]);
      expect(await screen.findByText('Atenção máxima perto de -23.5696, -46.7019')).toBeTruthy();
      expect(screen.queryByText('Não deu para carregar o risco agora.')).toBeNull();
    } finally {
      Intl.DateTimeFormat = original;
    }
  });

  it('a legenda explica a cor, o contorno e as letras do mapa', async () => {
    await render(<Mapa />);
    expect(await screen.findByText(/O contorno vale mesmo sem enxergar as cores/)).toBeTruthy();
    expect(screen.getByText(/R roubo, F furto, S atitude suspeita/)).toBeTruthy();
  });

  it('desenha ausente como "sem" (cinza), mantém baixo como baixo e alto como alto', async () => {
    await render(<Mapa />);
    await waitFor(() => expect(poligonos().length).toBeGreaterThan(2));
    const f = poligonos();
    expect(f.find((x) => x.areaId === 'g051_026')?.classe).toBe('alto');
    expect(f.find((x) => x.areaId === 'g051_027')?.classe).toBe('baixo');
    expect(f.filter((x) => x.classe === 'sem').length).toBeGreaterThan(0);
    expect(f.filter((x) => x.classe === 'sem').every((x) => !['g051_026', 'g051_027'].includes(x.areaId))).toBe(true);
  });

  it('sem GPS (promise que nunca resolve) cai em Pinheiros com aviso depois de 8 s', async () => {
    jest.useRealTimers();
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    jest.mocked(Location.getCurrentPositionAsync).mockReturnValueOnce(new Promise(() => {}) as never);
    await render(<Mapa />);
    expect(screen.getByText('Localizando…')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(8100);
    });
    expect(await screen.findByText(/Não deu para achar sua localização/)).toBeTruthy();
    await waitFor(() => expect(consultar).toHaveBeenCalled());
    const bbox = consultar.mock.calls[0][0];
    expect((bbox.minLat + bbox.maxLat) / 2).toBeCloseTo(-23.567249, 3);
  });
});

describe('camadas do mapa', () => {
  it('Delegacias, Estações e PM são interruptores com rótulo; ligar chama a API uma vez e mostra o nome', async () => {
    await render(<Mapa />);
    const chave = await screen.findByLabelText('Delegacias');
    expect(screen.getByLabelText('Estações')).toBeTruthy();
    expect(screen.getByLabelText('PM')).toBeTruthy();
    expect(obterCamada).not.toHaveBeenCalled();
    await fireEvent(chave, 'valueChange', true);
    expect(await screen.findByText('1º DP Sintético')).toBeTruthy();
    expect(obterCamada).toHaveBeenCalledTimes(1);
    expect(obterCamada).toHaveBeenCalledWith('delegacias');
    await fireEvent(chave, 'valueChange', false);
    await fireEvent(chave, 'valueChange', true);
    expect(obterCamada).toHaveBeenCalledTimes(1); // guardada
  });

  it('falha na camada mostra a mensagem e mantém o mapa de risco', async () => {
    obterCamada.mockRejectedValue(new Error('rede'));
    await render(<Mapa />);
    await fireEvent(await screen.findByLabelText('Delegacias'), 'valueChange', true);
    expect(await screen.findByText('Não deu para carregar as delegacias agora.')).toBeTruthy();
    expect(screen.getByText('Áreas com atenção máxima agora')).toBeTruthy();
    expect(screen.getByTestId('maplibre-Map')).toBeTruthy();
  });
});

describe('relatos no mapa', () => {
  it('relato visível mostra tipo, "há 12 min" e "Confirmar que também vi", que chama relatos.confirmar(id)', async () => {
    listarRelatos.mockResolvedValue([relato('r1', 12)]);
    await render(<Mapa />);
    expect(await screen.findByText('há 12 min')).toBeTruthy();
    expect(screen.getAllByText('Roubo').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Confirmar que também vi'));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('Obrigado, sua confirmação foi enviada.')).toBeTruthy();
  });

  it('relato com mais de 2 h não aparece', async () => {
    listarRelatos.mockResolvedValue([relato('velho', 125)]);
    await render(<Mapa />);
    await waitFor(() => expect(listarRelatos).toHaveBeenCalled());
    expect(screen.queryByLabelText('Confirmar que também vi')).toBeNull();
  });

  it('falha ao confirmar avisa e deixa tentar de novo', async () => {
    listarRelatos.mockResolvedValue([relato('r1', 5)]);
    confirmar.mockRejectedValueOnce(new Error('rede'));
    await render(<Mapa />);
    await fireEvent.press(await screen.findByLabelText('Confirmar que também vi'));
    expect(await screen.findByText('Não deu para confirmar agora. Tente de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Confirmar que também vi'));
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(2));
  });

  it('item 6: "Relatar aqui" abre o relato no centro do mapa visível (caminho sem GPS)', async () => {
    mockPush.mockReset();
    await render(<Mapa />);
    await fireEvent.press(await screen.findByLabelText('Relatar aqui'));
    // centro inicial = posição do mock de expo-location (-23.5614, -46.6559)
    expect(mockPush).toHaveBeenCalledWith('/relato?lat=-23.56140&lng=-46.65590');
  });

  it('item 6: sem permissão de localização, "Relatar aqui" usa o centro de Pinheiros mostrado no mapa', async () => {
    mockPush.mockReset();
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      granted: false, status: 'denied', canAskAgain: true, expires: 'never',
    } as never);
    await render(<Mapa />);
    await screen.findByText('Sem permissão de localização: mostrando a região de Pinheiros.');
    await fireEvent.press(await screen.findByLabelText('Relatar aqui'));
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/relato\?lat=-23\.\d{5}&lng=-46\.\d{5}$/);
  });
});
