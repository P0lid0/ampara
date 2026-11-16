import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Ajustes from '../(tabs)/ajustes';
import { api } from '../../api/endpoints';
import { sair } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { useAlarmes } from '../../guardiao/store';
import { iniciarServicoGuardiao, pararServicoGuardiao } from '../../guardiao/servico';

jest.setTimeout(60000);

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});
jest.mock('../../auth/sessao', () => ({
  ...jest.requireActual('../../auth/sessao'),
  sair: jest.fn(async () => undefined),
}));
jest.mock('../../guardiao/servico', () => ({
  iniciarServicoGuardiao: jest.fn(async () => undefined),
  pararServicoGuardiao: jest.fn(async () => undefined),
}));
jest.mock('../../api/endpoints', () => ({
  api: {
    chaveiros: { listar: jest.fn(), comando: jest.fn() },
    me: { consentimentoRota: jest.fn() },
  },
}));

const espera = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  useAlarmes.getState().limpar();
  jest.mocked(sair).mockClear();
  jest.mocked(iniciarServicoGuardiao).mockClear();
  jest.mocked(pararServicoGuardiao).mockClear();
  jest.mocked(api.chaveiros.listar).mockReset().mockRejectedValue(new Error('sem rede'));
  jest.mocked(api.chaveiros.comando).mockReset().mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('aba Ajustes', () => {
  it('Ajustes: modo demonstração só aparece ligado; "Repetir 5 vezes" resulta em 1 alerta no histórico', async () => {
    await render(<Ajustes />);
    const chave = await screen.findByLabelText('Modo demonstração');
    expect(screen.queryByRole('button', { name: 'Simular alerta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Repetir o mesmo alerta 5 vezes' })).toBeNull();

    await fireEvent(chave, 'valueChange', true);
    await espera();
    expect(await sessaoRepo(await abrirBanco()).get('demo')).toBe('1');
    for (const nome of ['Simular alerta', 'Simular cancelamento', 'Simular teste', 'Simular bateria baixa']) {
      expect(screen.getByRole('button', { name: nome })).toBeTruthy();
    }

    await fireEvent.press(screen.getByRole('button', { name: 'Repetir o mesmo alerta 5 vezes' }));
    await espera();
    expect(await ocorrenciaRepo(await abrirBanco()).listar()).toHaveLength(1);
    expect(Object.keys(useAlarmes.getState().estado.ativos)).toHaveLength(1);
    expect(screen.getByText('1 alerta novo e 4 repetidos ignorados. Confirmações ao chaveiro: 5.')).toBeTruthy();
  });

  it('modo demonstração funciona sem internet: alerta, cancelamento, teste e bateria baixa', async () => {
    await sessaoRepo(await abrirBanco()).set('demo', '1');
    await render(<Ajustes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Simular alerta' }));
    await espera();
    expect(Object.keys(useAlarmes.getState().estado.ativos)).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Simular cancelamento' }));
    await espera();
    expect(useAlarmes.getState().estado.ativos).toEqual({});
    expect((await ocorrenciaRepo(await abrirBanco()).listar())[0].estado).toBe('Cancelada');

    await fireEvent.press(screen.getByRole('button', { name: 'Simular teste' }));
    await espera();
    expect(screen.getByText('Chaveiro funcionando')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Simular bateria baixa' }));
    await espera();
    expect(screen.getByText(/^Bateria do chaveiro em \d+%\. Carregue para continuar protegido\.$/)).toBeTruthy();
  });

  it('Ajustes: "Sair e apagar dados" chama sair() após confirmação', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<Ajustes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair e apagar dados deste aparelho' }));
    expect(alerta).toHaveBeenCalledTimes(1);
    expect(sair).not.toHaveBeenCalled();
    const botoes = alerta.mock.calls[0][2] ?? [];
    const confirmar = botoes.find((b) => b.style === 'destructive');
    await act(async () => {
      confirmar?.onPress?.();
    });
    expect(sair).toHaveBeenCalledTimes(1);
  });

  it('"Sou guardião: receber alarmes" liga guardiao_ativo e inicia o serviço; desligar para o serviço', async () => {
    await render(<Ajustes />);
    const chave = await screen.findByLabelText('Sou guardião: receber alarmes');
    await fireEvent(chave, 'valueChange', true);
    await espera();
    expect(await sessaoRepo(await abrirBanco()).get('guardiao_ativo')).toBe('1');
    expect(iniciarServicoGuardiao).toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Sou guardião: receber alarmes'), 'valueChange', false);
    await espera();
    expect(await sessaoRepo(await abrirBanco()).get('guardiao_ativo')).toBe('0');
    expect(pararServicoGuardiao).toHaveBeenCalled();
  });

  it('"Alarme sem tela cheia" grava alarme_plano_b', async () => {
    await render(<Ajustes />);
    await fireEvent(await screen.findByLabelText('Alarme sem tela cheia'), 'valueChange', true);
    await espera();
    expect(await sessaoRepo(await abrirBanco()).get('alarme_plano_b')).toBe('1');
  });

  it('mostra a frase "Sobre"', async () => {
    await render(<Ajustes />);
    expect(await screen.findByText('O Ampara não bloqueia o seu celular nem as suas contas: ele avisa quem pode fazer isso.')).toBeTruthy();
  });
});
