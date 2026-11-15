import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import OnboardingImei from '../imei';
import { ApiErro } from '../../../api/cliente';
import { api } from '../../../api/endpoints';
import { abrirBanco } from '../../../db/db';

jest.setTimeout(60000);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));
jest.mock('../../../api/endpoints', () => ({ api: { aparelhos: { criar: jest.fn() } } }));

// SINTETICO: IMEI de teste com Luhn valido, nunca de aparelho real.
const IMEI = '490154203237518';
const criar = jest.mocked(api.aparelhos.criar);

beforeEach(() => {
  mockReplace.mockReset();
  criar.mockReset();
  criar.mockResolvedValue(undefined);
});

async function irParaPasso(n: 1 | 2 | 3) {
  await render(<OnboardingImei />);
  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
  if (n === 1) return;
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  if (n === 2) return;
  await fireEvent.press(screen.getByRole('button', { name: 'Digitar o número' }));
  await fireEvent.changeText(screen.getByLabelText('IMEI'), IMEI);
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

describe('onboarding do IMEI', () => {
  it('mostra 4 modos de obter: caixa/nota, *#06#, Ajustes, câmera', async () => {
    await irParaPasso(1);
    expect(screen.getByText(/caixa ou na nota fiscal/)).toBeTruthy();
    expect(screen.getByText(/\*#06#/)).toBeTruthy();
    expect(screen.getByText(/Ajustes, Sobre o telefone/)).toBeTruthy();
    expect(screen.getByText(/Pela câmera/)).toBeTruthy();
  });

  it('"Abrir o discador" chama Linking.openURL com tel:*%2306%23', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await irParaPasso(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir o discador' }));
    expect(abrir).toHaveBeenCalledWith('tel:*%2306%23');
  });

  it('IMEI inválido: botão desabilitado e texto de orientação', async () => {
    await irParaPasso(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Digitar o número' }));
    await fireEvent.changeText(screen.getByLabelText('IMEI'), '490154203237519');
    expect(screen.getByText(/O IMEI tem 15 números e passa numa conferência\. Confira os dígitos\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('Confirmar fica desabilitado sem marca e modelo', async () => {
    await irParaPasso(3);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('RF4: câmera negada mostra o campo de digitação e a frase "Sem a câmera, digite o número."', async () => {
    const negada = { granted: false, status: 'denied', canAskAgain: false, expires: 'never' };
    jest.mocked(useCameraPermissions).mockReturnValue([negada, jest.fn(async () => negada), jest.fn(async () => negada)] as never);
    await irParaPasso(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler pela câmera' }));
    expect(await screen.findByText('Sem a câmera, digite o número.')).toBeTruthy();
    expect(screen.getByLabelText('IMEI')).toBeTruthy();
  });

  it('envia só dígitos: api.aparelhos.criar chamado com {imei, marca, modelo}', async () => {
    await irParaPasso(3);
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Marca Teste');
    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'Modelo Teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(criar).toHaveBeenCalledWith({ imei: IMEI, marca: 'Marca Teste', modelo: 'Modelo Teste' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('máscara visual no campo, mas só dígitos no valor enviado', async () => {
    await irParaPasso(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Digitar o número' }));
    await fireEvent.changeText(screen.getByLabelText('IMEI'), '49-015420-323751-8');
    expect(screen.getByLabelText('IMEI').props.value).toBe('49-015420-323751-8');
  });

  it('422 mostra detalheCidadao da API', async () => {
    criar.mockRejectedValue(new ApiErro(422, 'x', 'Dados inválidos', 'Esse IMEI não passou na conferência do servidor.'));
    await irParaPasso(3);
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Marca Teste');
    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'Modelo Teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/Esse IMEI não passou na conferência do servidor\./)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('RF5: após enviar, o IMEI não está em nenhuma tabela do SQLite, nenhum console o recebeu e o campo é limpo', async () => {
    const logs = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')].map((s) =>
      s.mockImplementation(() => undefined),
    );
    await irParaPasso(3);
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Marca Teste');
    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'Modelo Teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));

    // Campo limpo: voltando ao passo do número, não sobrou nada digitado.
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByLabelText('IMEI').props.value).toBe('');

    // Nenhuma tabela do banco local contém o IMEI.
    const banco = await abrirBanco();
    const tabelas = await banco.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
    for (const { name } of tabelas) {
      const linhas = await banco.all<Record<string, unknown>>(`SELECT * FROM "${name}"`);
      expect(JSON.stringify(linhas)).not.toContain(IMEI);
    }
    for (const espiao of logs) {
      for (const chamada of espiao.mock.calls) expect(JSON.stringify(chamada)).not.toContain(IMEI);
      espiao.mockRestore();
    }
  });
});
