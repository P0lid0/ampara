import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingGuardioes from '../guardioes';
import { api } from '../../../api/endpoints';
import { abrirBanco } from '../../../db/db';
import { sessaoRepo } from '../../../db/repos';
import { lerConcluidos } from '../../../onboarding/passos';

jest.setTimeout(60000);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));
jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: (props: { value: string }) => <View testID="qrcode" accessibilityValue={{ text: props.value }} {...props} /> };
});
jest.mock('../../../api/endpoints', () => ({
  api: { guardioes: { listar: jest.fn(), criarConvite: jest.fn(), ordenar: jest.fn() } },
}));

const listar = jest.mocked(api.guardioes.listar);
const criarConvite = jest.mocked(api.guardioes.criarConvite);
const ordenar = jest.mocked(api.guardioes.ordenar);

// SINTETICO: nomes de teste.
const G = (n: number) => ({ guardiaoId: `g${n}`, nome: `Guardião ${n}`, ordem: n });
const espera = () => new Promise((r) => setTimeout(r, 50));

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  mockReplace.mockReset();
  listar.mockReset().mockResolvedValue([]);
  criarConvite.mockReset().mockResolvedValue({ codigo: 'ABC123', expiraEm: new Date(Date.now() + 10 * 60_000).toISOString() });
  ordenar.mockReset().mockResolvedValue(undefined);
});

describe('onboarding: guardiões', () => {
  it('mostra "Passo 5 de 8" e busca a lista ao abrir', async () => {
    listar.mockResolvedValue([G(1)]);
    await render(<OnboardingGuardioes />);
    expect(screen.getByText('Passo 5 de 8')).toBeTruthy();
    expect(await screen.findByText('Guardião 1')).toBeTruthy();
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('gerar convite mostra o código de 6 caracteres, o QR com o payload ampara://… e o prazo', async () => {
    await render(<OnboardingGuardioes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }));
    expect(await screen.findByText('ABC123')).toBeTruthy();
    expect(screen.getByLabelText('QR do convite. Código ABC123')).toBeTruthy();
    expect(screen.getByTestId('qrcode').props.value).toBe('ampara://guardiao/aceitar?codigo=ABC123');
    expect(screen.getByTestId('qr-convite').props.accessibilityHint).toBeUndefined();
    expect(screen.getByText(/Vale por \d{2}:\d{2}/)).toBeTruthy();
  });

  it('convite vencido mostra a frase de vencido', async () => {
    criarConvite.mockResolvedValue({ codigo: 'ABC123', expiraEm: new Date(Date.now() - 1000).toISOString() });
    await render(<OnboardingGuardioes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }));
    expect(await screen.findByText(/Esse código venceu/)).toBeTruthy();
  });

  it('com 3 guardiões "Convidar" fica desabilitado e a frase diz "Você já tem 3 guardiões."', async () => {
    listar.mockResolvedValue([G(1), G(2), G(3)]);
    await render(<OnboardingGuardioes />);
    expect(await screen.findByText('Você já tem 3 guardiões.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Convidar' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Convidar' }));
    expect(criarConvite).not.toHaveBeenCalled();
  });

  it('subir/descer chama api.guardioes.ordenar com os ids na nova ordem', async () => {
    listar.mockResolvedValue([G(1), G(2), G(3)]);
    await render(<OnboardingGuardioes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Subir Guardião 2' }));
    expect(ordenar).toHaveBeenLastCalledWith(['g2', 'g1', 'g3']);
    await fireEvent.press(await screen.findByRole('button', { name: 'Descer Guardião 2' }));
    expect(ordenar).toHaveBeenLastCalledWith(['g1', 'g2', 'g3']);
  });

  it('o primeiro não sobe e o último não desce', async () => {
    listar.mockResolvedValue([G(1), G(2)]);
    await render(<OnboardingGuardioes />);
    await screen.findByText('Guardião 1');
    expect(screen.getByRole('button', { name: 'Subir Guardião 1' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Descer Guardião 2' }).props.accessibilityState.disabled).toBe(true);
  });

  it('falha ao reordenar volta a ordem anterior e mostra o erro', async () => {
    listar.mockResolvedValue([G(1), G(2)]);
    ordenar.mockRejectedValue(new Error('x'));
    await render(<OnboardingGuardioes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Subir Guardião 2' }));
    expect(await screen.findByText(/Não foi possível concluir agora/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Subir Guardião 2' }));
    expect(ordenar).toHaveBeenLastCalledWith(['g2', 'g1']);
  });

  it('"Fazer depois" sem guardiões conclui o passo e segue', async () => {
    await render(<OnboardingGuardioes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Fazer depois' }));
    await espera();
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect((await lerConcluidos(await abrirBanco())).has('guardioes')).toBe(true);
  });

  it('com guardião o botão é "Continuar"', async () => {
    listar.mockResolvedValue([G(1)]);
    await render(<OnboardingGuardioes />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    await espera();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('não mostra telefone de guardião', async () => {
    listar.mockResolvedValue([G(1)]);
    await render(<OnboardingGuardioes />);
    await screen.findByText('Guardião 1');
    expect(screen.queryByText(/telefone|\(\d{2}\)/i)).toBeNull();
  });
});
