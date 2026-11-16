import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Bo from '../bo';
import { ApiErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { RetornoDto } from '../../api/tipos';
import { sair } from '../../auth/sessao';
import { esquecerAcompanhamentos } from '../../prevencao/acompanhamentoMemoria';

jest.setTimeout(60000);

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../api/endpoints', () => ({
  api: { ocorrencias: { bo: jest.fn(), compartilharPolicia: jest.fn(), retorno: jest.fn(), acompanhamento: jest.fn() } },
}));

const bo = jest.mocked(api.ocorrencias.bo);
const retorno = jest.mocked(api.ocorrencias.retorno);
const acompanhamento = jest.mocked(api.ocorrencias.acompanhamento);

// SINTETICO: dados de teste.
const BO = {
  texto: 'Comunico o roubo de um celular, em 12/11 às 17:41.',
  delegacia: { nome: '1ª Delegacia Demo', endereco: 'Rua Demo, 100', lat: -23.55, lng: -46.63 },
  linkDelegaciaEletronica: 'https://example.com/delegacia-eletronica',
};
const RET: RetornoDto = {
  protocolo: 'PP-2026-000001',
  status: 'atendida',
  mensagem: 'Equipe acionada, procure a delegacia.',
  atualizadoEm: '2026-11-14T18:30:00Z',
  boStatus: 'nao_registrado',
  recuperacao: 'sem_noticia',
};
const NUMERO = 'Número do BO (opcional)';
const NAO_ENVIADO = 'Ainda não enviado à polícia.';
const AVISO_SUBSTITUI = 'Salvar substitui o acompanhamento anterior. Se você já salvou um número de BO, digite de novo.';

beforeEach(() => {
  mockParams = { ocorrenciaId: 'oc-1' };
  bo.mockReset().mockResolvedValue(BO);
  retorno.mockReset().mockRejectedValue(new ApiErro(404, 'não encontrado'));
  acompanhamento.mockReset().mockResolvedValue(undefined);
  esquecerAcompanhamentos();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('retorno da polícia no BO', () => {
  it('BO: retorno 404 mostra "Ainda não enviado à polícia."', async () => {
    await render(<Bo />);
    expect(await screen.findByText(NAO_ENVIADO)).toBeTruthy();
  });

  it('BO: retorno atendida mostra "Atendida" e a mensagem da polícia', async () => {
    retorno.mockResolvedValue(RET);
    await render(<Bo />);
    expect(await screen.findByText('Atendida')).toBeTruthy();
    expect(screen.getByText('Equipe acionada, procure a delegacia.')).toBeTruthy();
    expect(screen.getByText('Retorno do protocolo PP-2026-000001')).toBeTruthy();
  });

  it('BO: atualiza o retorno a cada 60 s enquanto a tela está aberta e para ao sair (sem vazar timer)', async () => {
    jest.useFakeTimers();
    const tela = await render(<Bo />);
    await act(async () => {});
    expect(retorno).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(retorno).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(retorno).toHaveBeenCalledTimes(3);
    await tela.unmount();
    await act(async () => {
      jest.advanceTimersByTime(180_000);
    });
    expect(retorno).toHaveBeenCalledTimes(3); // 3 minutos depois de sair, nenhuma consulta nova: o intervalo foi limpo
  });
});

describe('acompanhamento no BO', () => {
  it('salvar chama PUT com {boNumero, boStatus:"registrado", recuperacao:"sem_noticia"}, mostra "Salvo." e o retorno seguinte traz os mesmos valores; sem número, boNumero não é enviado', async () => {
    retorno.mockResolvedValue(RET);
    await render(<Bo />);
    await screen.findByText('Atendida');
    await fireEvent.changeText(screen.getByLabelText(NUMERO), 'AB123/2026');
    await fireEvent.press(screen.getByLabelText('BO registrado'));
    retorno.mockResolvedValue({ ...RET, boNumero: 'AB123/2026', boStatus: 'registrado' });
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(acompanhamento).toHaveBeenCalledWith('oc-1', { boNumero: 'AB123/2026', boStatus: 'registrado', recuperacao: 'sem_noticia' });
    expect(await screen.findByText('Salvo.')).toBeTruthy();
    expect(retorno).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText(NUMERO).props.value).toBe('AB123/2026');
    expect(screen.getByLabelText('BO registrado').props.accessibilityState.selected).toBe(true);

    acompanhamento.mockClear();
    await fireEvent.changeText(screen.getByLabelText(NUMERO), '');
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(acompanhamento).toHaveBeenCalledTimes(1);
    expect(acompanhamento.mock.calls[0][1]).toEqual({ boStatus: 'registrado', recuperacao: 'sem_noticia' });
    expect('boNumero' in acompanhamento.mock.calls[0][1]).toBe(false);
  });

  it('boNumero com espaços ou 31+ caracteres é recusado com "Use até 30 letras, números, / ou -." e não chama a API', async () => {
    await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    await fireEvent.changeText(screen.getByLabelText(NUMERO), 'AB 12');
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(await screen.findByText('⚠ Use até 30 letras, números, / ou -.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(NUMERO), 'A'.repeat(31));
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(screen.getByText('⚠ Use até 30 letras, números, / ou -.')).toBeTruthy();
    expect(acompanhamento).not.toHaveBeenCalled();
  });

  it('o rótulo de status e de recuperação aparece em texto (não só cor), e vale também no modo emergência', async () => {
    retorno.mockResolvedValue({ ...RET, boStatus: 'registrado', recuperacao: 'localizado' });
    await render(<Bo />);
    await screen.findByText('Atendida');
    expect(screen.getByText('BO ainda não registrado')).toBeTruthy();
    expect(screen.getByText('BO registrado')).toBeTruthy();
    for (const t of ['Sem notícias do celular', 'Celular localizado', 'Celular recuperado']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByLabelText('Celular localizado').props.accessibilityState.selected).toBe(true);
    // emergência: a tela não depende do escopo, o PUT sai igual
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(acompanhamento).toHaveBeenCalledWith('oc-1', { boStatus: 'registrado', recuperacao: 'localizado' });
  });

  it('erro da API ao salvar mostra a mensagem e não mostra "Salvo."', async () => {
    acompanhamento.mockRejectedValue(new ApiErro(500, 'Falha', 'Erro', 'Tente de novo em instantes.'));
    await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(await screen.findByText('⚠ Tente de novo em instantes.')).toBeTruthy();
    expect(screen.queryByText('Salvo.')).toBeNull();
  });

  // Item 19: sem envio à polícia o GET /retorno dá 404 e o servidor não devolve o acompanhamento salvo.
  it('item 19: o acompanhamento salvo sem enviar à polícia volta preenchido ao reabrir a tela', async () => {
    const tela = await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    await fireEvent.changeText(screen.getByLabelText(NUMERO), 'AB123/2026');
    await fireEvent.press(screen.getByLabelText('BO registrado'));
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    await screen.findByText('Salvo.');
    await tela.unmount();

    await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    expect(screen.getByLabelText(NUMERO).props.value).toBe('AB123/2026');
    expect(screen.getByLabelText('BO registrado').props.accessibilityState.selected).toBe(true);
  });

  it('item 19: ao reabrir e mudar só a recuperação, o PUT leva o número já salvo (não apaga o BO)', async () => {
    const tela = await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    await fireEvent.changeText(screen.getByLabelText(NUMERO), 'AB123/2026');
    await fireEvent.press(screen.getByLabelText('BO registrado'));
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    await screen.findByText('Salvo.');
    await tela.unmount();
    acompanhamento.mockClear();

    await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    await fireEvent.press(screen.getByLabelText('Celular localizado'));
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    expect(acompanhamento).toHaveBeenCalledWith('oc-1', { boNumero: 'AB123/2026', boStatus: 'registrado', recuperacao: 'localizado' });
  });

  it('item 19: sem nada conhecido, a tela avisa que salvar substitui o acompanhamento anterior', async () => {
    await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    expect(screen.getByText(AVISO_SUBSTITUI)).toBeTruthy();
  });

  it('item 19: a memória do acompanhamento fica só no processo e some ao sair', async () => {
    const tela = await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    await fireEvent.changeText(screen.getByLabelText(NUMERO), 'AB123/2026');
    await fireEvent.press(screen.getByLabelText('Salvar acompanhamento'));
    await screen.findByText('Salvo.');
    await tela.unmount();
    await act(async () => {
      await sair('manual');
    });
    await render(<Bo />);
    await screen.findByText(NAO_ENVIADO);
    expect(screen.getByLabelText(NUMERO).props.value).toBe('');
  });
});
