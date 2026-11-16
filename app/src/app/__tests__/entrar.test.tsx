import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Entrar from '../entrar';
import { sair } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';

jest.setTimeout(60000);
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});

async function abrirEmergencia() {
  await render(<Entrar />);
  await fireEvent.press(screen.getByRole('button', { name: 'Estou no aparelho de outra pessoa' }));
  await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.test');
  await fireEvent.changeText(screen.getByLabelText('Código de emergência'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Palavra secreta'), 'palavra-teste');
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar em modo emergência' }));
}

describe('tela de entrada', () => {
  it('429 em /auth/emergencia mostra "Muitas tentativas erradas. Aguarde 15 minutos."', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    await abrirEmergencia();
    expect(await screen.findByText(/Muitas tentativas erradas\. Aguarde 15 minutos\./)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each([401, 404])('%i em /auth/emergencia mostra a MESMA frase "Dados incorretos." (sem revelar se o e-mail existe)', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await abrirEmergencia();
    expect(await screen.findByText(/Dados incorretos\./)).toBeTruthy();
  });

  it('login com sucesso vai para a tela inicial', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: 't', expiraEm: new Date(Date.now() + 3_600_000).toISOString() }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await render(<Entrar />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.test');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha-teste');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('erro de login mostra o detalheCidadao do servidor', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ title: 'x', detalheCidadao: 'E-mail ou senha incorretos.' }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    await render(<Entrar />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.test');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/E-mail ou senha incorretos\./)).toBeTruthy();
  });

  it('depois de a sessão expirar mostra "Sua sessão terminou. Entre de novo."', async () => {
    await render(<Entrar />);
    expect(screen.queryByText(/Sua sessão terminou/)).toBeNull();
    await act(async () => {
      await sair('expirou');
    });
    expect(await screen.findByText('Sua sessão terminou. Entre de novo.')).toBeTruthy();
  });

  it('item 8: guardião com a sessão expirada vê "Entre de novo para receber alarmes."', async () => {
    await sessaoRepo(await abrirBanco()).set('guardiao_ativo', '1');
    await render(<Entrar />);
    await act(async () => {
      await sair('expirou');
    });
    expect(await screen.findByText('Você é guardião: entre de novo para receber alarmes.')).toBeTruthy();
    await sessaoRepo(await abrirBanco()).apagarTudo();
  });

  it('quem não é guardião não vê o aviso de alarme ao expirar', async () => {
    await sessaoRepo(await abrirBanco()).apagarTudo();
    await render(<Entrar />);
    await act(async () => {
      await sair('expirou');
    });
    await screen.findByText('Sua sessão terminou. Entre de novo.');
    expect(screen.queryByText(/receber alarmes/)).toBeNull();
  });
});
