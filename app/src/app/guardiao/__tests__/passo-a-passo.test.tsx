import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import PassoAPasso from '../passo-a-passo';
import { ApiErro } from '../../../api/cliente';
import { api } from '../../../api/endpoints';
import type { OcorrenciaDto } from '../../../api/tipos';
import { abrirBanco } from '../../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../../db/repos';
import { emitirPasso } from '../../../guardiao/passosAoVivo';

jest.setTimeout(60000);

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../../api/endpoints', () => ({
  api: { ocorrencias: { obter: jest.fn(), concluirPasso: jest.fn() }, contas: { catalogo: jest.fn() } },
}));

const obter = jest.mocked(api.ocorrencias.obter);
const concluir = jest.mocked(api.ocorrencias.concluirPasso);

// SINTETICO: contas e telefones de demonstração, nunca dado real.
const base = (): OcorrenciaDto => ({
  id: 'oc-1',
  estado: 'Aberta',
  origem: 'chaveiro',
  iniciadaEm: '2026-11-14T17:00:00Z',
  momento: null,
  passos: ['Banco', 'CelularSeguro', 'Operadora', 'Senhas', 'Bo'].map((passo) => ({ passo: passo as never, concluidoEm: null })),
  alertas: [],
  contas: [
    { nome: 'Banco Alfa', tipo: 'banco', telefone: '(11) 4004-0001', link: 'https://alfa.example/bloquear' },
    { nome: 'Banco Beta', tipo: 'banco', telefone: '0800 123 0002', link: 'https://beta.example/bloquear' },
    { nome: 'Operadora Gama', tipo: 'operadora', telefone: '*611', link: 'https://gama.example/bloquear' },
  ],
});

const cartao = (passo: string) => within(screen.getByTestId(`passo-${passo}`));

let abrir: jest.SpyInstance;
beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  mockParams = { ocorrenciaId: 'oc-1' };
  obter.mockReset().mockResolvedValue(base());
  concluir.mockReset().mockResolvedValue(undefined);
  abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
});
afterEach(() => abrir.mockRestore());

async function montar() {
  await render(<PassoAPasso />);
  await screen.findByText('0 de 5 feitos');
}

describe('passo a passo do guardião', () => {
  it('mostra 5 passos na ordem Banco, Celular Seguro, Operadora, Senhas, BO com "0 de 5 feitos"', async () => {
    await montar();
    const ordem = ['Banco', 'Celular Seguro', 'Operadora', 'Senhas', 'BO'];
    const titulos = screen
      .getAllByRole('header')
      .map((h) => h.props.children)
      .filter((t): t is string => typeof t === 'string' && ordem.includes(t));
    expect(titulos).toEqual(ordem);
    expect(screen.getByText('Troque a senha do e-mail e das contas que estavam no celular.')).toBeTruthy();
    expect(screen.getByText('Avise que o BO será gerado pela própria pessoa, em outro aparelho.')).toBeTruthy();
  });

  it('Banco lista só as contas tipo banco da vítima com "Ligar para" e "Abrir site de"; Operadora só tipo operadora; o catálogo nunca é chamado', async () => {
    await montar();
    const banco = cartao('Banco');
    expect(banco.getByRole('button', { name: 'Ligar para Banco Alfa' })).toBeTruthy();
    expect(banco.getByRole('button', { name: 'Abrir site de Banco Beta' })).toBeTruthy();
    expect(banco.queryByRole('button', { name: /Operadora Gama/ })).toBeNull();
    const op = cartao('Operadora');
    expect(op.getByRole('button', { name: 'Ligar para Operadora Gama' })).toBeTruthy();
    expect(op.queryByRole('button', { name: /Banco/ })).toBeNull();

    await fireEvent.press(banco.getByRole('button', { name: 'Ligar para Banco Alfa' }));
    expect(abrir).toHaveBeenCalledWith('tel:1140040001');
    await fireEvent.press(op.getByRole('button', { name: 'Abrir site de Operadora Gama' }));
    expect(abrir).toHaveBeenCalledWith('https://gama.example/bloquear');
    expect(api.contas.catalogo).not.toHaveBeenCalled();
  });

  it('vítima sem conta de banco: "Nenhum banco cadastrado. Ligue para o seu banco pelo número do cartão."', async () => {
    obter.mockResolvedValue({ ...base(), contas: base().contas.filter((c) => c.tipo !== 'banco') });
    await montar();
    expect(cartao('Banco').getByText('Nenhum banco cadastrado. Ligue para o seu banco pelo número do cartão.')).toBeTruthy();
  });

  it('Celular Seguro abre o site oficial', async () => {
    await montar();
    await fireEvent.press(cartao('CelularSeguro').getByRole('button', { name: 'Abrir o Celular Seguro' }));
    expect(abrir).toHaveBeenCalledWith('https://www.celularseguro.sp.gov.br');
  });

  it('"Marcar como feito" no Banco chama concluirPasso(id,"Banco") e mostra "Feito às 14:32" e "1 de 5 feitos"', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    jest.setSystemTime(new Date('2026-11-14T17:32:00Z'));
    try {
      await montar();
      await fireEvent.press(cartao('Banco').getByRole('button', { name: 'Marcar como feito' }));
      expect(await screen.findByText('Feito às 14:32')).toBeTruthy();
      expect(concluir).toHaveBeenCalledWith('oc-1', 'Banco');
      expect(screen.getByText('1 de 5 feitos')).toBeTruthy();
      expect(cartao('Banco').queryByRole('button', { name: 'Marcar como feito' })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('passo já feito no servidor chega com o horário', async () => {
    const o = base();
    o.passos[3] = { passo: 'Senhas', concluidoEm: '2026-11-14T18:05:00Z' };
    obter.mockResolvedValue(o);
    await render(<PassoAPasso />);
    expect(await screen.findByText('1 de 5 feitos')).toBeTruthy();
    expect(cartao('Senhas').getByText('Feito às 15:05')).toBeTruthy();
  });

  it('PassoAtualizado de outro guardião atualiza o passo sem recarregar', async () => {
    await montar();
    await act(async () => {
      emitirPasso({ ocorrenciaId: 'oc-1', passo: 'Operadora', concluidoEm: '2026-11-14T17:40:00Z' });
    });
    expect(await screen.findByText('Feito às 14:40')).toBeTruthy();
    expect(screen.getByText('1 de 5 feitos')).toBeTruthy();
    expect(obter).toHaveBeenCalledTimes(1);
    // evento de outra ocorrência é ignorado
    await act(async () => {
      emitirPasso({ ocorrenciaId: 'outra', passo: 'Senhas', concluidoEm: '2026-11-14T17:41:00Z' });
    });
    expect(screen.getByText('1 de 5 feitos')).toBeTruthy();
  });

  it('sem rede: a ação falha com "Sem conexão. Tente de novo." e o botão continua habilitado', async () => {
    concluir.mockRejectedValue(new ApiErro(0, 'Sem conexão com a internet.', undefined, 'Sem conexão com a internet.'));
    await montar();
    await fireEvent.press(cartao('Senhas').getByRole('button', { name: 'Marcar como feito' }));
    expect(await screen.findByText('⚠ Sem conexão. Tente de novo.')).toBeTruthy();
    const botao = cartao('Senhas').getByRole('button', { name: 'Marcar como feito' });
    expect(botao.props.accessibilityState?.disabled).toBeFalsy();
    expect(screen.getByText('0 de 5 feitos')).toBeTruthy();
  });

  it('falha ao carregar mostra o erro e "Tentar de novo" recarrega', async () => {
    obter.mockRejectedValueOnce(new ApiErro(0, 'x', undefined, 'x'));
    await render(<PassoAPasso />);
    expect(await screen.findByText('⚠ Sem conexão. Tente de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('0 de 5 feitos')).toBeTruthy();
  });

  it('ocorrenciaId "demo-1" usa fonteLocal e grava na tabela passo; nenhuma chamada a fetch', async () => {
    mockParams = { ocorrenciaId: 'demo-1' };
    const f = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sem rede'));
    try {
      await montar();
      expect(cartao('Banco').getByRole('button', { name: /^Ligar para / })).toBeTruthy();
      await fireEvent.press(cartao('Banco').getByRole('button', { name: 'Marcar como feito' }));
      expect(await screen.findByText('1 de 5 feitos')).toBeTruthy();
      const gravados = await ocorrenciaRepo(await abrirBanco()).passos('demo-1');
      expect(gravados.map((p) => p.passo)).toEqual(['Banco']);
      expect(f).not.toHaveBeenCalled();
      expect(obter).not.toHaveBeenCalled();
      expect(concluir).not.toHaveBeenCalled();
    } finally {
      f.mockRestore();
    }
  });
});
