import { act, fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingChaveiro from '../chaveiro';
import { ApiErro } from '../../../api/cliente';
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
  api: { chaveiros: { criar: jest.fn(), listar: jest.fn(), comando: jest.fn() } },
}));

const criar = jest.mocked(api.chaveiros.criar);
const listar = jest.mocked(api.chaveiros.listar);
const comando = jest.mocked(api.chaveiros.comando);

// SINTETICO: deviceId de demonstração.
const ID = 'chaveiro-ampara-ab12cd';
const noAr = () => [{ deviceId: ID, online: true, bateria: 80, vistoEm: new Date().toISOString() }];
const espera = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  mockReplace.mockReset();
  criar.mockReset().mockResolvedValue(undefined);
  listar.mockReset().mockResolvedValue([]);
  comando.mockReset().mockResolvedValue(undefined);
});

const cameraMock = jest.requireMock('expo-camera') as { useCameraPermissions: jest.Mock };
const permissaoPadrao = cameraMock.useCameraPermissions.getMockImplementation();

afterEach(() => {
  jest.useRealTimers();
  cameraMock.useCameraPermissions.mockImplementation(permissaoPadrao);
});

async function digitarEParear(id = ID) {
  await fireEvent.press(screen.getByRole('button', { name: 'Digitar o código' }));
  await fireEvent.changeText(screen.getByLabelText('Código do chaveiro'), id);
  await fireEvent.press(screen.getByRole('button', { name: 'Parear' }));
}

describe('onboarding: chaveiro', () => {
  it('mostra "Passo 6 de 7" e a ajuda do código de demonstração', async () => {
    await render(<OnboardingChaveiro />);
    expect(screen.getByText('Passo 6 de 7')).toBeTruthy();
    expect(screen.getByText(/chaveiro-ampara-xxxxxx/)).toBeTruthy();
  });

  it('parear digitado chama criar(deviceId) e, quando aparece em listar(), mostra o cartão e deixa continuar', async () => {
    listar.mockResolvedValue(noAr());
    await render(<OnboardingChaveiro />);
    await digitarEParear();
    expect(criar).toHaveBeenCalledWith(ID);
    expect(await screen.findByRole('button', { name: 'Achar meu chaveiro' })).toBeTruthy();
    expect(screen.getAllByText(/Conectado/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await espera();
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect((await lerConcluidos(await abrirBanco())).has('chaveiro')).toBe(true);
  });

  it('sem aparecer em 20 s mostra "Ainda não ouvi o chaveiro. Confira se ele está ligado." e permite continuar', async () => {
    jest.useFakeTimers();
    await render(<OnboardingChaveiro />);
    await digitarEParear();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(21_000);
    });
    expect(screen.getByText('Ainda não ouvi o chaveiro. Confira se ele está ligado.')).toBeTruthy();
    expect(listar.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState.disabled).toBe(false);
  });

  it('deviceId inválido mostra erro e não chama a API', async () => {
    await render(<OnboardingChaveiro />);
    await digitarEParear('Chaveiro-1');
    expect(screen.getByText(/código do chaveiro não parece certo/i)).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
    expect(listar).not.toHaveBeenCalled();
  });

  it('erro da API ao parear mostra a mensagem e não fica esperando', async () => {
    criar.mockRejectedValue(new ApiErro(409, 'x', 'Conflito', 'Esse chaveiro já está pareado.'));
    await render(<OnboardingChaveiro />);
    await digitarEParear();
    expect(await screen.findByText(/Esse chaveiro já está pareado/)).toBeTruthy();
    expect(listar).not.toHaveBeenCalled();
  });

  it('ler o QR (conteúdo é o deviceId puro) pareia com esse código', async () => {
    listar.mockResolvedValue(noAr());
    await render(<OnboardingChaveiro />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR' }));
    await fireEvent(screen.getByTestId('camera'), 'barcodeScanned', { data: ` ${ID}\n` });
    await espera();
    expect(criar).toHaveBeenCalledWith(ID);
  });

  it('QR que não é de chaveiro mostra erro e não chama a API', async () => {
    await render(<OnboardingChaveiro />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR' }));
    await fireEvent(screen.getByTestId('camera'), 'barcodeScanned', { data: 'https://exemplo.test/x' });
    expect(screen.getByText(/código do chaveiro não parece certo/i)).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
  });

  it('câmera negada orienta a digitar', async () => {
    const negada = { granted: false, status: 'denied', canAskAgain: false, expires: 'never' };
    cameraMock.useCameraPermissions.mockImplementation(() => [negada, jest.fn(async () => negada)]);
    await render(<OnboardingChaveiro />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR' }));
    expect(await screen.findByText('Sem a câmera, digite o código.')).toBeTruthy();
    expect(screen.getByLabelText('Código do chaveiro')).toBeTruthy();
  });

  it('"Fazer depois" conclui o passo e segue', async () => {
    await render(<OnboardingChaveiro />);
    await fireEvent.press(screen.getByRole('button', { name: 'Fazer depois' }));
    await espera();
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect((await lerConcluidos(await abrirBanco())).has('chaveiro')).toBe(true);
  });
});

describe('CartaoChaveiro', () => {
  const { CartaoChaveiro } = require('../../../ui/CartaoChaveiro') as typeof import('../../../ui/CartaoChaveiro');

  it('lista ao abrir, manda ping uma vez e repete a lista a cada 30 s', async () => {
    jest.useFakeTimers();
    listar.mockResolvedValue(noAr());
    await render(<CartaoChaveiro />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(listar).toHaveBeenCalledTimes(1);
    expect(comando).toHaveBeenCalledTimes(1);
    expect(comando).toHaveBeenCalledWith(ID, 'ping');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(listar).toHaveBeenCalledTimes(2);
    expect(comando).toHaveBeenCalledTimes(1);
  });

  it('"Achar meu chaveiro" chama comando(deviceId,"find") e anuncia o aviso', async () => {
    listar.mockResolvedValue(noAr());
    await render(<CartaoChaveiro />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Achar meu chaveiro' }));
    expect(comando).toHaveBeenCalledWith(ID, 'find');
    expect(await screen.findByText('O chaveiro vai piscar e tocar por 6 segundos.')).toBeTruthy();
  });

  it('falha no comando mostra erro em vez do aviso', async () => {
    listar.mockResolvedValue(noAr());
    await render(<CartaoChaveiro />);
    comando.mockRejectedValue(new Error('x'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Achar meu chaveiro' }));
    expect(await screen.findByText(/Não foi possível concluir agora/)).toBeTruthy();
    expect(screen.queryByText(/vai piscar/)).toBeNull();
  });

  it('"Como testar" explica segurar o botão por 3 segundos', async () => {
    listar.mockResolvedValue(noAr());
    await render(<CartaoChaveiro />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Como testar' }));
    expect(screen.getByText(/segure o botão do chaveiro por 3 segundos/i)).toBeTruthy();
  });

  it('bateria baixa mostra o aviso no cartão', async () => {
    listar.mockResolvedValue([{ deviceId: ID, online: true, bateria: 12, vistoEm: new Date().toISOString() }]);
    await render(<CartaoChaveiro />);
    expect((await screen.findAllByText(/Bateria baixa \(12%\)/)).length).toBeGreaterThan(0);
  });

  it('falha de rede não congela o relógio: "Conectado" vira "Sem conexão" depois de 90 s sem resposta', async () => {
    jest.useFakeTimers();
    listar.mockResolvedValueOnce(noAr());
    await render(<CartaoChaveiro />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/^Conectado\./)).toBeTruthy();
    listar.mockRejectedValue(new Error('sem rede'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });
    expect(screen.getByText(/^Sem conexão\./)).toBeTruthy();
    expect(screen.getByText(/Não foi possível concluir agora/)).toBeTruthy();
  });

  it('desmontar para o polling de 30 s', async () => {
    jest.useFakeTimers();
    listar.mockResolvedValue(noAr());
    const tela = await render(<CartaoChaveiro />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(listar).toHaveBeenCalledTimes(1);
    await tela.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(90_000);
    });
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('com dois chaveiros e deviceId, mostra e pinga o escolhido, não o primeiro', async () => {
    jest.useFakeTimers();
    const outro = 'chaveiro-ampara-zz99';
    listar.mockResolvedValue([
      { deviceId: outro, online: true, bateria: 80, vistoEm: new Date().toISOString() },
      ...noAr(),
    ]);
    await render(<CartaoChaveiro deviceId={ID} />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(comando).toHaveBeenCalledWith(ID, 'ping');
    expect(screen.getByText(ID)).toBeTruthy();
    expect(screen.queryByText(outro)).toBeNull();
  });

  it('sem chaveiro mostra a frase e esconde "Achar meu chaveiro"', async () => {
    await render(<CartaoChaveiro />);
    expect(await screen.findByText('Nenhum chaveiro pareado.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Achar meu chaveiro' })).toBeNull();
    expect(comando).not.toHaveBeenCalled();
  });
});
