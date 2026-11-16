import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import OnboardingEmergencia from '../emergencia';
import OnboardingConta from '../conta';
import { ApiErro } from '../../../api/cliente';
import { api } from '../../../api/endpoints';
import * as sessao from '../../../auth/sessao';
import { abrirBanco } from '../../../db/db';
import { sessaoRepo } from '../../../db/repos';
import { lerConcluidos } from '../../../onboarding/passos';

jest.setTimeout(60000);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));
jest.mock('../../../api/endpoints', () => ({ api: { me: { definirEmergencia: jest.fn() } } }));
jest.mock('../../../auth/sessao', () => ({ criarConta: jest.fn() }));

const definir = jest.mocked(api.me.definirEmergencia);
const criarConta = jest.mocked(sessao.criarConta);

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo(); // o mock de expo-sqlite guarda o banco entre testes do mesmo arquivo
  mockReplace.mockReset();
  definir.mockReset().mockResolvedValue(undefined);
  criarConta.mockReset().mockResolvedValue(undefined);
});

describe('onboarding: código de emergência', () => {
  it('mostra "Passo 8 de 8"', async () => {
    await render(<OnboardingEmergencia />);
    expect(screen.getByText('Passo 8 de 8')).toBeTruthy();
  });

  it('"123" mostra erro "O código tem 6 números." e não chama a API', async () => {
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '123');
    await fireEvent.changeText(screen.getByLabelText('Repita o código'), '123');
    await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'palavra-teste');
    await fireEvent.changeText(screen.getByLabelText('Repita a palavra secreta'), 'palavra-teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/O código tem 6 números\./)).toBeTruthy();
    expect(definir).not.toHaveBeenCalled();
  });

  it('palavra secreta com menos de 4 caracteres mostra erro e não chama a API', async () => {
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Repita o código'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'abc');
    await fireEvent.changeText(screen.getByLabelText('Repita a palavra secreta'), 'abc');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/A palavra secreta precisa de 4 caracteres ou mais\./)).toBeTruthy();
    expect(definir).not.toHaveBeenCalled();
  });

  it('código de 6 dígitos e palavra de 4+ chamam a API, concluem o passo e seguem; campos são limpos', async () => {
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Repita o código'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'palavra-teste');
    await fireEvent.changeText(screen.getByLabelText('Repita a palavra secreta'), 'palavra-teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(definir).toHaveBeenCalledWith({ codigo: '123456', palavraSecreta: 'palavra-teste' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(await lerConcluidos(await abrirBanco())).toEqual(new Set(['emergencia']));
    expect(screen.getByLabelText('Código de emergência').props.value).toBe('');
  });

  it('código repetido diferente mostra erro e não chama a API', async () => {
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Repita o código'), '123465');
    await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'palavra-teste');
    await fireEvent.changeText(screen.getByLabelText('Repita a palavra secreta'), 'palavra-teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Os dois códigos precisam ser iguais\./)).toBeTruthy();
    expect(definir).not.toHaveBeenCalled();
  });

  it('palavra secreta repetida diferente mostra erro e não chama a API', async () => {
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Repita o código'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'palavra-teste');
    await fireEvent.changeText(screen.getByLabelText('Repita a palavra secreta'), 'palavra-teste2');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/As duas palavras secretas precisam ser iguais\./)).toBeTruthy();
    expect(definir).not.toHaveBeenCalled();
  });

  it('o campo do código só aceita números', async () => {
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '12a3-45678');
    expect(screen.getByLabelText('Código de emergência').props.value).toBe('123456');
  });

  it('erro da API mostra o detalheCidadao e não conclui o passo', async () => {
    definir.mockRejectedValue(new ApiErro(422, 'x', 'Dados inválidos', 'Esse código é fácil demais.'));
    await render(<OnboardingEmergencia />);
    await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '111111');
    await fireEvent.changeText(screen.getByLabelText('Repita o código'), '111111');
    await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'palavra-teste');
    await fireEvent.changeText(screen.getByLabelText('Repita a palavra secreta'), 'palavra-teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Esse código é fácil demais\./)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(await lerConcluidos(await abrirBanco())).toEqual(new Set());
  });
});

describe('onboarding: conta', () => {
  it('conta: senha com menos de 8 caracteres mostra "Use pelo menos 8 caracteres." e não chama a API', async () => {
    await render(<OnboardingConta />);
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana Teste');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.test');
    await fireEvent.changeText(screen.getByLabelText('Senha'), '1234567');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText(/Use pelo menos 8 caracteres\./)).toBeTruthy();
    expect(criarConta).not.toHaveBeenCalled();
  });

  it('senha de 8 caracteres chama criarConta, conclui o passo e segue', async () => {
    await render(<OnboardingConta />);
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana Teste');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.test');
    await fireEvent.changeText(screen.getByLabelText('Senha'), '12345678');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(criarConta).toHaveBeenCalledWith('Ana Teste', 'ana@exemplo.test', '12345678'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(await lerConcluidos(await abrirBanco())).toEqual(new Set(['conta']));
  });
});
