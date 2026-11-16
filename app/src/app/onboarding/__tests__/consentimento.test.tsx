import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import OnboardingConsentimento from '../consentimento';
import { api } from '../../../api/endpoints';
import { abrirBanco } from '../../../db/db';
import { sessaoRepo } from '../../../db/repos';
import { lerConcluidos } from '../../../onboarding/passos';
import { iniciarRota } from '../../../rota/tarefa';

jest.setTimeout(60000);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));
jest.mock('../../../api/endpoints', () => ({ api: { me: { consentimentoRota: jest.fn() } } }));
jest.mock('../../../rota/tarefa', () => ({ iniciarRota: jest.fn() }));

const consentir = jest.mocked(api.me.consentimentoRota);
const primeiroPlano = jest.mocked(Location.requestForegroundPermissionsAsync);
const segundoPlano = jest.mocked(Location.requestBackgroundPermissionsAsync);
const concedida = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' } as never;
const negada = { granted: false, status: 'denied', canAskAgain: false, expires: 'never' } as never;
const ligar = jest.mocked(iniciarRota);
const abrirConfig = jest.spyOn(Linking, 'openSettings');

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo(); // o mock de expo-sqlite guarda o banco entre testes do mesmo arquivo
  mockReplace.mockReset();
  consentir.mockReset().mockResolvedValue(undefined);
  primeiroPlano.mockReset().mockResolvedValue(concedida);
  segundoPlano.mockReset().mockResolvedValue(concedida);
  ligar.mockReset().mockResolvedValue(undefined);
  abrirConfig.mockReset().mockResolvedValue(undefined);
});

describe('onboarding: consentimento da rota', () => {
  it('mostra o texto simples e a barra "Passo 2 de 7"', async () => {
    await render(<OnboardingConsentimento />);
    expect(screen.getByText('Passo 2 de 7')).toBeTruthy();
    expect(screen.getByText(/Guardamos por 7 dias por onde você andou, só para você marcar onde foi o roubo e gerar o BO\. Só você vê\. Pode desligar quando quiser em Ajustes\./)).toBeTruthy();
  });

  it('aceitar chama api.me.consentimentoRota(true) e depois pede localização em primeiro e segundo plano, cada uma depois de uma explicação', async () => {
    await render(<OnboardingConsentimento />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }));
    await waitFor(() => expect(consentir).toHaveBeenCalledWith(true));
    expect(primeiroPlano).not.toHaveBeenCalled(); // antes do pedido há a tela de explicação
    expect(await screen.findByText('Localização com o app aberto')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Permitir localização' }));
    await waitFor(() => expect(primeiroPlano).toHaveBeenCalledTimes(1));
    expect(segundoPlano).not.toHaveBeenCalled();
    expect(await screen.findByText('Localização o tempo todo')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Permitir em segundo plano' }));
    await waitFor(() => expect(segundoPlano).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ligar).toHaveBeenCalledTimes(1)); // a rota liga depois das permissões
    expect(abrirConfig).not.toHaveBeenCalled();
    expect(screen.queryByText(/Rota pausada/)).toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(await lerConcluidos(await abrirBanco())).toEqual(new Set(['consentimento']));
  });

  it('recusar chama consentimentoRota(false), NÃO pede permissão e o passo conta como concluído', async () => {
    await render(<OnboardingConsentimento />);
    await fireEvent.press(screen.getByRole('button', { name: 'Agora não' }));
    await waitFor(() => expect(consentir).toHaveBeenCalledWith(false));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(primeiroPlano).not.toHaveBeenCalled();
    expect(segundoPlano).not.toHaveBeenCalled();
    expect(ligar).not.toHaveBeenCalled();
    expect(await lerConcluidos(await abrirBanco())).toEqual(new Set(['consentimento']));
  });

  it('RF4: permissão de localização negada ainda grava o consentimento e mostra "Rota pausada: falta a permissão de localização."', async () => {
    primeiroPlano.mockResolvedValue(negada);
    await render(<OnboardingConsentimento />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Permitir localização' }));
    expect(await screen.findByText(/Rota pausada: falta a permissão de localização\./)).toBeTruthy();
    expect(consentir).toHaveBeenCalledWith(true);
    expect(segundoPlano).not.toHaveBeenCalled();
    expect(ligar).toHaveBeenCalledTimes(1); // grava o consentimento no aparelho (a tarefa não liga sem permissão)
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(await lerConcluidos(await abrirBanco())).toEqual(new Set(['consentimento']));
  });

  it('segundo plano negado mostra "Rota pausada", liga a rota com o app aberto e abre as configurações do app', async () => {
    segundoPlano.mockResolvedValue(negada);
    await render(<OnboardingConsentimento />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Permitir localização' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Permitir em segundo plano' }));
    expect(await screen.findByText(/Rota pausada: falta a permissão de localização\./)).toBeTruthy();
    expect(ligar).toHaveBeenCalledTimes(1);
    expect(abrirConfig).toHaveBeenCalledTimes(1);
  });

  it('falha ao ligar a rota mostra "Rota pausada" e ainda deixa continuar', async () => {
    ligar.mockRejectedValue(new Error('servico'));
    await render(<OnboardingConsentimento />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Permitir localização' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Permitir em segundo plano' }));
    expect(await screen.findByText(/Rota pausada: falta a permissão de localização\./)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('falha da API não avança nem pede permissão', async () => {
    consentir.mockRejectedValue(new Error('rede'));
    await render(<OnboardingConsentimento />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(primeiroPlano).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
