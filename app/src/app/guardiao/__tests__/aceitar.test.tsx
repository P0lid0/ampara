import { fireEvent, render, screen } from '@testing-library/react-native';
import AceitarConvite, { normalizarCodigoConvite } from '../aceitar';
import { ApiErro } from '../../../api/cliente';
import { api } from '../../../api/endpoints';
import { abrirBanco } from '../../../db/db';
import { sessaoRepo } from '../../../db/repos';
import { iniciarServicoGuardiao } from '../../../guardiao/servico';

jest.setTimeout(60000);

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../../api/endpoints', () => ({ api: { guardioes: { aceitar: jest.fn() } } }));
jest.mock('../../../guardiao/servico', () => ({ iniciarServicoGuardiao: jest.fn(async () => undefined) }));

const aceitar = jest.mocked(api.guardioes.aceitar);
const PADRAO = 'Não foi possível concluir agora. Tente de novo.';
const espera = () => new Promise((r) => setTimeout(r, 50));

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  mockReplace.mockReset();
  mockParams = {};
  aceitar.mockReset().mockResolvedValue(undefined);
});

describe('normalizarCodigoConvite', () => {
  it('tira espaços e hífens e põe em maiúsculas', () => {
    expect(normalizarCodigoConvite(' ab-c12 3 ')).toBe('ABC123');
  });
  it('só aceita exatamente 6 letras/números', () => {
    expect(normalizarCodigoConvite('ABC12')).toBeNull();
    expect(normalizarCodigoConvite('ABC1234')).toBeNull();
    expect(normalizarCodigoConvite('ABC12!')).toBeNull();
    expect(normalizarCodigoConvite('')).toBeNull();
  });
});

async function digitarEAceitar(texto: string) {
  await fireEvent.changeText(screen.getByLabelText('Código do convite'), texto);
  await fireEvent.press(screen.getByRole('button', { name: 'Aceitar convite' }));
}

describe('aceitar convite de guardião', () => {
  it.each([
    [404, 'Código inválido. Confira com quem te convidou.'],
    [410, 'Esse código venceu. Peça outro para quem te convidou.'],
    [409, 'Essa pessoa já tem 3 guardiões.'],
  ])('status %i mostra a frase certa e não repete o código digitado', async (status, frase) => {
    aceitar.mockRejectedValue(new ApiErro(status, PADRAO, undefined, PADRAO));
    await render(<AceitarConvite />);
    await digitarEAceitar('abc123');
    const alerta = await screen.findByText(`⚠ ${frase}`);
    expect(JSON.stringify(alerta.props.children)).not.toMatch(/ABC123/i);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('usa o detalheCidadao da API quando existe', async () => {
    aceitar.mockRejectedValue(new ApiErro(410, 'm', undefined, 'Convite encerrado pela pessoa.'));
    await render(<AceitarConvite />);
    await digitarEAceitar('ABC123');
    expect(await screen.findByText('⚠ Convite encerrado pela pessoa.')).toBeTruthy();
  });

  it('código com tamanho errado mostra aviso e não chama a API', async () => {
    await render(<AceitarConvite />);
    await digitarEAceitar('ABC12');
    expect(await screen.findByText(/O código tem 6 letras ou números/)).toBeTruthy();
    expect(aceitar).not.toHaveBeenCalled();
  });

  it('sucesso chama api.guardioes.aceitar("ABC123") e liga guardiao_ativo', async () => {
    await render(<AceitarConvite />);
    await digitarEAceitar(' ab-c123 ');
    await espera();
    expect(aceitar).toHaveBeenCalledWith('ABC123');
    expect(await sessaoRepo(await abrirBanco()).get('guardiao_ativo')).toBe('1');
    expect(iniciarServicoGuardiao).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('deep link com ?codigo=ABC123 preenche o campo', async () => {
    mockParams = { codigo: 'abc123' };
    await render(<AceitarConvite />);
    expect(screen.getByLabelText('Código do convite').props.value).toBe('ABC123');
  });

  it('ler o QR (payload ampara://…) preenche o campo com o código', async () => {
    await render(<AceitarConvite />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR' }));
    await fireEvent(screen.getByTestId('camera'), 'barcodeScanned', { data: 'ampara://guardiao/aceitar?codigo=XYZ789' });
    expect(screen.getByLabelText('Código do convite').props.value).toBe('XYZ789');
  });

  it('QR que não é de convite avisa e não preenche', async () => {
    await render(<AceitarConvite />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR' }));
    await fireEvent(screen.getByTestId('camera'), 'barcodeScanned', { data: 'https://exemplo.test/qualquer-coisa-longa' });
    expect(await screen.findByText(/Esse QR não é de um convite/)).toBeTruthy();
    expect(screen.getByLabelText('Código do convite').props.value).toBe('');
  });

  it('câmera negada manda digitar o código', async () => {
    const { useCameraPermissions } = jest.requireMock('expo-camera') as { useCameraPermissions: jest.Mock };
    const negada = { granted: false, status: 'denied', canAskAgain: false, expires: 'never' };
    useCameraPermissions.mockReturnValue([negada, jest.fn(), jest.fn()]);
    await render(<AceitarConvite />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR' }));
    expect(await screen.findByText('Sem a câmera, digite o código.')).toBeTruthy();
  });
});
