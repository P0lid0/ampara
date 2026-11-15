import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingContas from '../contas';
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
jest.mock('../../../api/endpoints', () => ({
  api: { contas: { catalogo: jest.fn(), vincular: jest.fn() } },
}));

const catalogo = jest.mocked(api.contas.catalogo);
const vincular = jest.mocked(api.contas.vincular);

// SINTETICO: instituições e telefones de teste, não são dados reais.
const CATALOGO = [
  { id: 'b1', nome: 'Banco Teste Um', tipo: 'banco' as const, telefone: '0800 000 0001', link: 'https://exemplo.test/um', conferidoEm: '2026-11-12' },
  { id: 'b2', nome: 'Banco Teste Dois', tipo: 'banco' as const, telefone: '0800 000 0002', link: 'https://exemplo.test/dois', conferidoEm: '2026-11-12T00:00:00Z' },
  { id: 'o1', nome: 'Operadora Teste', tipo: 'operadora' as const, telefone: '1058', link: 'https://exemplo.test/op', conferidoEm: '2026-11-12' },
];

const espera = () => new Promise((r) => setTimeout(r, 50));

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  mockReplace.mockReset();
  catalogo.mockReset().mockResolvedValue(CATALOGO);
  vincular.mockReset().mockResolvedValue(undefined);
});

describe('onboarding: bancos e operadora', () => {
  it('mostra "Passo 4 de 7" e a lista do catálogo com tipo, telefone, link e "Conferido em 12/11/2026"', async () => {
    await render(<OnboardingContas />);
    expect(screen.getByText('Passo 4 de 7')).toBeTruthy();
    expect(await screen.findByText('Banco Teste Um')).toBeTruthy();
    expect(screen.getAllByText(/Conferido em 12\/11\/2026/)).toHaveLength(3);
    expect(screen.getAllByText('Banco')).toHaveLength(2);
    expect(screen.getByText('Operadora')).toBeTruthy();
    expect(screen.getByText(/1058/)).toBeTruthy();
    expect(screen.getByText(/exemplo\.test\/op/)).toBeTruthy();
  });

  it('vincula só os marcados (POST por catalogoId), conclui o passo e segue', async () => {
    await render(<OnboardingContas />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: /Banco Teste Dois/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Operadora Teste/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await espera();
    expect(vincular.mock.calls.map((c) => c[0])).toEqual(['b2', 'o1']);
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect((await lerConcluidos(await abrirBanco())).has('contas')).toBe(true);
  });

  it('pode seguir sem marcar nada: não chama a API e conclui o passo', async () => {
    await render(<OnboardingContas />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    await espera();
    expect(vincular).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect((await lerConcluidos(await abrirBanco())).has('contas')).toBe(true);
  });

  it('falha ao vincular mostra o erro, não segue e não repete o que já foi vinculado', async () => {
    vincular.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('x'));
    await render(<OnboardingContas />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: /Banco Teste Um/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Banco Teste Dois/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Não foi possível concluir agora/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    vincular.mockClear().mockResolvedValue(undefined);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await espera();
    expect(vincular.mock.calls.map((c) => c[0])).toEqual(['b2']);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('"Fazer depois" segue sem vincular', async () => {
    await render(<OnboardingContas />);
    await fireEvent.press(await screen.findByRole('checkbox', { name: /Banco Teste Um/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fazer depois' }));
    await espera();
    expect(vincular).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('falha ao carregar o catálogo mostra o erro e permite tentar de novo', async () => {
    catalogo.mockRejectedValueOnce(new Error('x'));
    await render(<OnboardingContas />);
    expect(await screen.findByText(/Não foi possível concluir agora/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Banco Teste Um')).toBeTruthy();
  });
});
