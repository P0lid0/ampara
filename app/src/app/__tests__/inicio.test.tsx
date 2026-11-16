import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import Inicio from '../(tabs)/index';
import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { PASSOS } from '../../onboarding/passos';

jest.setTimeout(60000);

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});
jest.mock('../../auth/sessao', () => ({
  ...jest.requireActual('../../auth/sessao'),
  useSessao: () => ({ autenticado: true, escopo: 'usuario', expiraEm: null }),
}));
jest.mock('../../api/endpoints', () => ({
  api: {
    me: { obter: jest.fn() },
    aparelhos: { listar: jest.fn() },
    contas: { listar: jest.fn() },
    guardioes: { listar: jest.fn() },
    chaveiros: { listar: jest.fn(), comando: jest.fn() },
    ocorrencias: { listar: jest.fn() },
  },
}));

// SINTETICO: chaveiro e ocorrência de demonstração.
const ID = 'chaveiro-ampara-ab12cd';
const semRede = () => Promise.reject(new Error('sem rede'));

beforeEach(async () => {
  const db = await abrirBanco();
  await sessaoRepo(db).apagarTudo();
  await sessaoRepo(db).set('onboarding.concluidos', JSON.stringify(PASSOS));
  mockReplace.mockReset();
  mockPush.mockReset();
  jest.mocked(api.me.obter).mockReset().mockImplementation(semRede);
  jest.mocked(api.aparelhos.listar).mockReset().mockImplementation(semRede);
  jest.mocked(api.contas.listar).mockReset().mockImplementation(semRede);
  jest.mocked(api.guardioes.listar).mockReset().mockResolvedValue([{ guardiaoId: 'g1', nome: 'Guardiã Demo', ordem: 0 }]);
  jest.mocked(api.chaveiros.comando).mockReset().mockResolvedValue(undefined);
  jest.mocked(api.chaveiros.listar).mockReset().mockResolvedValue([]);
  jest.mocked(api.ocorrencias.listar).mockReset().mockResolvedValue([]);
});

describe('aba Início', () => {
  it('Início: chaveiro offline mostra texto "Sem conexão" (não só cor) e rota pausada mostra o motivo escrito', async () => {
    jest.mocked(api.chaveiros.listar).mockResolvedValue([{ deviceId: ID, online: false, bateria: 80, vistoEm: null }]);
    // consentimento dado, permissões concedidas (mock), tarefa não registrada => "pausada"
    await sessaoRepo(await abrirBanco()).set('rota.consentimento', 'sim');
    await render(<Inicio />);
    expect((await screen.findAllByText(/Sem conexão/)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Rota pausada: o registro da rota parou neste aparelho. Toque em "Retomar a rota".')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retomar a rota' })).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sem consentimento a rota aparece desligada, com o motivo escrito', async () => {
    await render(<Inicio />);
    expect(await screen.findByText('Rota desligada: você não autorizou guardar a rota neste aparelho.')).toBeTruthy();
  });

  it('o botão Relatar um problema leva à tela de relato', async () => {
    mockPush.mockClear();
    await render(<Inicio />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Relatar um problema' }));
    expect(mockPush).toHaveBeenCalledWith('/relato');
  });

  it('mostra "Tenho um código de convite" mesmo com guardiões e leva à tela de aceitar convite', async () => {
    mockPush.mockClear();
    await render(<Inicio />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tenho um código de convite' }));
    expect(mockPush).toHaveBeenCalledWith('/guardiao/aceitar');
  });

  it('GET /guardioes vazio mostra "Você ainda não tem guardiões"', async () => {
    jest.mocked(api.guardioes.listar).mockResolvedValue([]);
    await render(<Inicio />);
    expect(await screen.findByText('Você ainda não tem guardiões')).toBeTruthy();
  });

  it('último alerta vem de GET /ocorrencias, com o estado escrito', async () => {
    jest.mocked(api.ocorrencias.listar).mockResolvedValue([
      { id: 'o1', estado: 'Cancelada', origem: 'chaveiro', iniciadaEm: '2026-11-16T13:00:00Z', momento: null, passos: [], alertas: [], contas: [] },
      { id: 'o2', estado: 'Aberta', origem: 'web', iniciadaEm: '2026-11-16T15:30:00Z', momento: null, passos: [], alertas: [], contas: [] },
    ]);
    await render(<Inicio />);
    expect(await screen.findByLabelText('Estado: Aberta')).toBeTruthy();
    expect(screen.getByText(/Último alerta: Aberta/)).toBeTruthy();
  });

  it('em demonstração o último alerta é o local, sem chamar GET /ocorrencias', async () => {
    const db = await abrirBanco();
    await sessaoRepo(db).set('demo', '1');
    await ocorrenciaRepo(db).upsert({
      id: 'demo-x', estado: 'Teste', origem: 'chaveiro', iniciadaEm: '2026-11-16T14:00:00.000Z',
      momentoEm: null, vitimaNome: 'Pessoa Demo', atualizadoEm: '2026-11-16T14:00:00.000Z',
    });
    await render(<Inicio />);
    expect(await screen.findByText(/Último alerta: Teste/)).toBeTruthy();
    expect(api.ocorrencias.listar).not.toHaveBeenCalled();
  });

  it('onboarding incompleto leva ao próximo passo', async () => {
    await sessaoRepo(await abrirBanco()).set('onboarding.concluidos', JSON.stringify(['conta']));
    await render(<Inicio />);
    await screen.findByText('Carregando...');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/consentimento');
  });

  it('item 4: ao entrar de novo, com o consentimento no servidor e nenhum neste aparelho, a rota volta a ser registrada', async () => {
    jest.mocked(api.me.obter).mockResolvedValue({
      usuarioId: 'u1', nome: 'Ana Teste', email: 'ana@exemplo.test', consentimentoRota: true, emergenciaConfigurada: true,
    });
    jest.mocked(Location.startLocationUpdatesAsync).mockClear();
    await render(<Inicio />);
    await screen.findByText(/^Rota /);
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith('ampara-rota', expect.anything());
    expect(await sessaoRepo(await abrirBanco()).get('rota.consentimento')).toBe('sim');
    expect(screen.queryByText('Rota desligada: você não autorizou guardar a rota neste aparelho.')).toBeNull();
  });
});
