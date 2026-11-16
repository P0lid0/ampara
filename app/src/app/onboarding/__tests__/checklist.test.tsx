import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingChecklist from '../checklist';
import { abrirBanco } from '../../../db/db';
import { sessaoRepo } from '../../../db/repos';
import { lerChecklist } from '../../../prevencao/checklist';
import { lerConcluidos } from '../../../onboarding/passos';

jest.setTimeout(60000);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  mockReplace.mockReset();
});

describe('checklist de prevenção', () => {
  it('checklist mostra "1 de 3 feitos" e cada item tem estado em texto ("Feito"/"Falta fazer")', async () => {
    await render(<OnboardingChecklist />);
    expect(screen.getByText('0 de 3 feitos')).toBeTruthy();
    expect(screen.getAllByText('Falta fazer')).toHaveLength(3);
    await fireEvent.press(screen.getByLabelText('Marcar como feito: Ligar a proteção contra roubo do sistema do celular'));
    expect(await screen.findByText('1 de 3 feitos')).toBeTruthy();
    expect(screen.getAllByText('Feito')).toHaveLength(1);
    expect(screen.getAllByText('Falta fazer')).toHaveLength(2);
    expect((await lerChecklist(await abrirBanco())).protecaoRoubo).toBe(true);
  });

  it('mostra "Passo 7 de 8" e "Continuar" conclui o passo mesmo com itens pendentes', async () => {
    await render(<OnboardingChecklist />);
    expect(screen.getByText('Passo 7 de 8')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continuar'));
    await screen.findByLabelText('Continuar');
    expect((await lerConcluidos(await abrirBanco())).has('checklist')).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
