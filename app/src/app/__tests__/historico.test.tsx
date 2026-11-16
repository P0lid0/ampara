import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Historico from '../(tabs)/historico';
import Detalhe from '../ocorrencia/[id]';
import { api } from '../../api/endpoints';
import type { OcorrenciaDto } from '../../api/tipos';
import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';

jest.setTimeout(60000);

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
let mockEscopo: 'usuario' | 'emergencia' | null = 'usuario';
const mockSair = jest.fn(async () => undefined);
// Telas com foco: `focar()` simula a volta à tela (o Stack mantém a tela montada).
const mockFocos = new Set<() => void | (() => void)>();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ replace: jest.fn(), push: mockPush }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) =>
      React.useEffect(() => {
        mockFocos.add(cb);
        const limpar = cb();
        return () => {
          mockFocos.delete(cb);
          if (typeof limpar === 'function') limpar();
        };
      }, [cb]),
    Stack: { Screen: () => null },
  };
});
jest.mock('../../auth/sessao', () => ({ useSessao: () => ({ escopo: mockEscopo }), sair: () => mockSair() }));

const focar = () =>
  act(async () => {
    for (const cb of [...mockFocos]) cb();
  });
jest.mock('../../api/endpoints', () => ({
  api: { ocorrencias: { listar: jest.fn(), obter: jest.fn() } },
}));

const listar = jest.mocked(api.ocorrencias.listar);
const obter = jest.mocked(api.ocorrencias.obter);

// SINTETICO: ocorrências de teste.
const oc = (id: string, estado: OcorrenciaDto['estado'], iniciadaEm: string, extra: Partial<OcorrenciaDto> = {}): OcorrenciaDto => ({
  id,
  estado,
  origem: 'chaveiro',
  iniciadaEm,
  momento: null,
  passos: [],
  alertas: [],
  contas: [],
  ...extra,
});

beforeEach(async () => {
  mockParams = {};
  mockEscopo = 'usuario';
  mockPush.mockReset();
  mockSair.mockClear();
  listar.mockReset().mockResolvedValue([]);
  obter.mockReset();
  await sessaoRepo(await abrirBanco()).apagarTudo();
});

describe('aba Histórico', () => {
  it('histórico: lista do mais novo ao mais antigo; cada linha mostra o estado em TEXTO (Aberta/Cancelada/Encerrada) além do ícone', async () => {
    listar.mockResolvedValue([
      oc('a', 'Encerrada', '2026-11-10T15:00:00Z'),
      oc('c', 'Aberta', '2026-11-13T15:00:00Z'),
      oc('b', 'Cancelada', '2026-11-12T15:00:00Z'),
    ]);
    await render(<Historico />);
    const linhas = await screen.findAllByTestId(/^linha-ocorrencia-/);
    expect(linhas.map((l) => l.props.testID)).toEqual(['linha-ocorrencia-c', 'linha-ocorrencia-b', 'linha-ocorrencia-a']);
    expect(screen.getByText('Aberta')).toBeTruthy();
    expect(screen.getByText('Cancelada')).toBeTruthy();
    expect(screen.getByText('Encerrada')).toBeTruthy();
    expect(screen.getByTestId('estado-icone-aberta')).toBeTruthy();
    await fireEvent.press(linhas[0]);
    expect(mockPush).toHaveBeenCalledWith('/ocorrencia/c');
  });

  it('histórico vazio mostra "Nenhuma ocorrência. Quando algo acontecer, aparece aqui."', async () => {
    await render(<Historico />);
    expect(await screen.findByText('Nenhuma ocorrência. Quando algo acontecer, aparece aqui.')).toBeTruthy();
  });

  it('modo emergência: oferece "Marcar onde foi (rota)" levando à rota com o ocorrenciaId', async () => {
    mockEscopo = 'emergencia';
    listar.mockResolvedValue([oc('x1', 'Aberta', '2026-11-13T15:00:00Z')]);
    await render(<Historico />);
    await fireEvent.press(await screen.findByLabelText('Marcar onde foi (rota)'));
    expect(mockPush).toHaveBeenCalledWith('/rota?ocorrenciaId=x1');
  });

  it('erro ao listar mostra a mensagem e permite tentar de novo', async () => {
    listar.mockRejectedValueOnce(new Error('x')).mockResolvedValue([oc('a', 'Aberta', '2026-11-13T15:00:00Z')]);
    await render(<Historico />);
    await fireEvent.press(await screen.findByLabelText('Tentar de novo'));
    expect(await screen.findByTestId('linha-ocorrencia-a')).toBeTruthy();
  });

  it('em demonstração lista as ocorrências locais, sem chamar a API', async () => {
    const db = await abrirBanco();
    await sessaoRepo(db).set('demo', '1');
    const { ocorrenciaRepo } = require('../../db/repos');
    await ocorrenciaRepo(db).upsert({
      id: 'demo-1',
      estado: 'Aberta',
      origem: 'chaveiro',
      iniciadaEm: '2026-11-13T15:00:00Z',
      momentoEm: null,
      vitimaNome: 'Pessoa Demo',
      atualizadoEm: '2026-11-13T15:00:00Z',
    });
    await render(<Historico />);
    expect(await screen.findByTestId('linha-ocorrencia-demo-1')).toBeTruthy();
    expect(listar).not.toHaveBeenCalled();
  });
});

describe('detalhe da ocorrência', () => {
  it('detalhe: linha do tempo com iniciada em, momento marcado e cada passo com horário ("Banco — 14:32"); passos não feitos aparecem como "Pendente"', async () => {
    mockParams = { id: 'oc-1' };
    obter.mockResolvedValue(
      oc('oc-1', 'Aberta', '2026-11-12T20:00:00Z', {
        momento: { em: '2026-11-12T20:41:00Z', lat: -23.5, lng: -46.6 },
        passos: [
          { passo: 'Banco', concluidoEm: '2026-11-12T17:32:00Z' },
          { passo: 'CelularSeguro', concluidoEm: null },
        ],
      }),
    );
    await render(<Detalhe />);
    expect(await screen.findByText('Iniciada em 12/11 às 17:00')).toBeTruthy();
    expect(screen.getByText('Momento marcado: 17:41')).toBeTruthy();
    expect(screen.getByText('Banco — 14:32')).toBeTruthy();
    expect(screen.getByText('Celular Seguro — Pendente')).toBeTruthy();
    // passos que a API nem listou também aparecem como pendentes
    expect(screen.getByText('Operadora — Pendente')).toBeTruthy();
    expect(screen.getByText('BO — Pendente')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver o BO'));
    expect(mockPush).toHaveBeenCalledWith('/bo?ocorrenciaId=oc-1');
    await fireEvent.press(screen.getByLabelText('Marcar onde foi (rota)'));
    expect(mockPush).toHaveBeenCalledWith('/rota?ocorrenciaId=oc-1');
  });

  it('detalhe sem momento marcado avisa por escrito', async () => {
    mockParams = { id: 'oc-2' };
    obter.mockResolvedValue(oc('oc-2', 'Cancelada', '2026-11-12T20:00:00Z'));
    await render(<Detalhe />);
    expect(await screen.findByText('Momento ainda não marcado')).toBeTruthy();
  });

  it('item 11: ao voltar para o detalhe (rota → BO → voltar) ele recarrega e mostra o momento marcado', async () => {
    mockParams = { id: 'oc-3' };
    obter.mockResolvedValue(oc('oc-3', 'Aberta', '2026-11-12T20:00:00Z'));
    await render(<Detalhe />);
    expect(await screen.findByText('Momento ainda não marcado')).toBeTruthy();
    obter.mockResolvedValue(oc('oc-3', 'Aberta', '2026-11-12T20:00:00Z', { momento: { em: '2026-11-12T20:41:00Z', lat: -23.5, lng: -46.6 } }));
    await focar();
    expect(await screen.findByText('Momento marcado: 17:41')).toBeTruthy();
  });

  it('item 12: em demonstração o detalhe mostra o estado e o início gravados (os mesmos da lista)', async () => {
    const db = await abrirBanco();
    const { ocorrenciaRepo } = require('../../db/repos');
    // SINTETICO: ocorrência de demonstração.
    await ocorrenciaRepo(db).upsert({
      id: 'demo-9', estado: 'Cancelada', origem: 'chaveiro', iniciadaEm: '2026-11-12T17:00:00Z',
      momentoEm: null, vitimaNome: 'Pessoa Demo', atualizadoEm: '2026-11-12T17:05:00Z',
    });
    mockParams = { id: 'demo-9' };
    await render(<Detalhe />);
    expect(await screen.findByText('Iniciada em 12/11 às 14:00')).toBeTruthy();
    expect(screen.getByText('Cancelada')).toBeTruthy();
    expect(screen.queryByText('Aberta')).toBeNull();
  });
});

describe('item 9: sair do modo emergência (aparelho emprestado)', () => {
  it('no modo emergência o Histórico e o detalhe têm "Sair deste aparelho", que chama sair()', async () => {
    mockEscopo = 'emergencia';
    listar.mockResolvedValue([oc('x1', 'Aberta', '2026-11-13T15:00:00Z')]);
    await render(<Historico />);
    await fireEvent.press(await screen.findByLabelText('Sair deste aparelho'));
    expect(mockSair).toHaveBeenCalledTimes(1);

    mockParams = { id: 'x1' };
    obter.mockResolvedValue(oc('x1', 'Aberta', '2026-11-13T15:00:00Z'));
    await render(<Detalhe />);
    expect(await screen.findByLabelText('Sair deste aparelho')).toBeTruthy();
  });

  it('na sessão de usuário não aparece (lá o Sair fica em Ajustes)', async () => {
    listar.mockResolvedValue([oc('x1', 'Aberta', '2026-11-13T15:00:00Z')]);
    await render(<Historico />);
    await screen.findByTestId('linha-ocorrencia-x1');
    expect(screen.queryByLabelText('Sair deste aparelho')).toBeNull();
  });
});
