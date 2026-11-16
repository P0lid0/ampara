import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import Relato from '../relato';
import { ApiErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';
import { relatoRepo, sessaoRepo } from '../../db/repos';

jest.setTimeout(60000);

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../api/endpoints', () => ({ api: { relatos: { criar: jest.fn() } } }));

const criar = jest.mocked(api.relatos.criar);
const CAMPO = 'O que aconteceu (opcional)';

beforeEach(async () => {
  mockParams = {};
  criar.mockReset().mockResolvedValue(undefined);
  await sessaoRepo(await abrirBanco()).apagarTudo();
});

async function abrirTela() {
  await render(<Relato />);
  await screen.findByText('Não descreva pessoas. Diga só o que e onde.');
}
const escolher = async (rotulo: string) => fireEvent.press(screen.getByRole('radio', { name: rotulo }));
const enviar = async () => fireEvent.press(screen.getByRole('button', { name: 'Enviar relato' }));

describe('tela Relato', () => {
  it('a tela avisa em texto fixo "Não descreva pessoas. Diga só o que e onde." e tem os 3 tipos', async () => {
    await abrirTela();
    expect(screen.getByRole('radio', { name: 'Roubo' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Furto' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Suspeita' })).toBeTruthy();
  });

  it('sem tipo escolhido não chama a API e pede o tipo', async () => {
    await abrirTela();
    await enviar();
    expect(await screen.findByText('Escolha o que aconteceu.')).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
  });

  it('envia com o tipo, a posição e o instante da captura em UTC com Z', async () => {
    await abrirTela();
    await escolher('Furto');
    await fireEvent.changeText(screen.getByLabelText(CAMPO), '  moto parada na esquina  ');
    await enviar();
    expect(await screen.findByText('Relato enviado. Obrigado.')).toBeTruthy();
    expect(criar).toHaveBeenCalledTimes(1);
    const corpo = criar.mock.calls[0][0];
    expect(corpo).toMatchObject({ tipo: 'furto', texto: 'moto parada na esquina' });
    expect(typeof corpo.lat).toBe('number');
    expect(corpo.em).toMatch(/Z$/);
  });

  it('sem texto o campo não vai no corpo', async () => {
    await abrirTela();
    await escolher('Roubo');
    await enviar();
    await screen.findByText('Relato enviado. Obrigado.');
    expect('texto' in criar.mock.calls[0][0]).toBe(false);
  });

  it('usa o ponto escolhido no mapa (parâmetros lat e lng) sem pedir o GPS', async () => {
    mockParams = { lat: '-23.57', lng: '-46.7' };
    const gps = jest.mocked(Location.getCurrentPositionAsync);
    gps.mockClear();
    await abrirTela();
    await escolher('Suspeita');
    await enviar();
    await screen.findByText('Relato enviado. Obrigado.');
    expect(criar.mock.calls[0][0]).toMatchObject({ lat: -23.57, lng: -46.7 });
    expect(gps).not.toHaveBeenCalled();
  });

  it('emoji e 10.000 caracteres colados não quebram a tela (campo trunca em 140)', async () => {
    await abrirTela();
    const campo = screen.getByLabelText(CAMPO);
    await fireEvent.changeText(campo, 'x'.repeat(10000));
    expect(screen.getByLabelText(CAMPO).props.value).toHaveLength(140);
    await fireEvent.changeText(campo, '😀'.repeat(10000));
    const v: string = screen.getByLabelText(CAMPO).props.value;
    expect(v.length).toBeLessThanOrEqual(140);
    expect(() => encodeURIComponent(v)).not.toThrow(); // sem par substituto cortado ao meio
    await fireEvent.changeText(campo, 'linha 1\nlinha 2');
    expect(screen.getByLabelText(CAMPO).props.value).toBe('linha 1 linha 2');
  });

  it('sem rede o relato vai para relato_pendente e a tela diz "Guardado. Envio quando a internet voltar."', async () => {
    criar.mockRejectedValue(new ApiErro(0, 'Sem conexão com a internet.', undefined, 'Sem conexão com a internet.'));
    await abrirTela();
    await escolher('Roubo');
    await fireEvent.changeText(screen.getByLabelText(CAMPO), 'bolsa levada');
    await enviar();
    expect(await screen.findByText('Guardado. Envio quando a internet voltar.')).toBeTruthy();
    const fila = await relatoRepo(await abrirBanco()).listar();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ tipo: 'roubo', texto: 'bolsa levada' });
    expect(fila[0].em).toMatch(/Z$/);
  });

  it('ao abrir, envia o que ficou pendente de antes', async () => {
    const repo = relatoRepo(await abrirBanco());
    await repo.adicionar({ tipo: 'furto', lat: -23.5, lng: -46.6, em: new Date(Date.now() - 30 * 60000).toISOString(), texto: null });
    await abrirTela();
    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect(await repo.listar()).toEqual([]));
  });

  it('422 (abuso/PII) mostra o detalheCidadao e NÃO repete o texto digitado na mensagem', async () => {
    criar.mockRejectedValue(new ApiErro(422, 'x', undefined, 'Não foi possível publicar este relato. Descreva só o que aconteceu e onde.'));
    await abrirTela();
    await escolher('Roubo');
    await fireEvent.changeText(screen.getByLabelText(CAMPO), 'texto-secreto-digitado');
    await enviar();
    expect(await screen.findByText('Não foi possível publicar este relato. Descreva só o que aconteceu e onde.')).toBeTruthy();
    expect(screen.queryByText(/texto-secreto-digitado/)).toBeNull();
    expect(await relatoRepo(await abrirBanco()).listar()).toEqual([]); // recusado não entra na fila
  });

  it('enviar duas vezes seguidas rápido (duplo toque) chama a API 1 vez', async () => {
    let resolver: () => void = () => undefined;
    criar.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
    await abrirTela();
    await escolher('Roubo');
    await enviar();
    await enviar();
    await act(async () => { resolver(); });
    await screen.findByText('Relato enviado. Obrigado.');
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('segundo relato em menos de 2 min é barrado sem chamar a API', async () => {
    await abrirTela();
    await escolher('Roubo');
    await enviar();
    await screen.findByText('Relato enviado. Obrigado.');
    await escolher('Furto');
    await enviar();
    expect(await screen.findByText('Espere 2 minutos entre um relato e outro.')).toBeTruthy();
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('relato permitido de novo depois de 2 min do último', async () => {
    await sessaoRepo(await abrirBanco()).set('relato.ultimoEm', new Date(Date.now() - 3 * 60000).toISOString());
    await abrirTela();
    await escolher('Roubo');
    await enviar();
    await screen.findByText('Relato enviado. Obrigado.');
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('sem permissão de localização e sem ponto do mapa: avisa e não envia', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      granted: false, status: 'denied', canAskAgain: true, expires: 'never',
    } as never);
    await abrirTela();
    await escolher('Roubo');
    await enviar();
    expect(await screen.findByText(/Não deu para achar o local/)).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
  });

  it('item 6: o aviso sem local aponta um caminho que existe ("Relatar aqui" no Mapa), não "escolher o ponto no mapa"', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      granted: false, status: 'denied', canAskAgain: true, expires: 'never',
    } as never);
    await abrirTela();
    await escolher('Roubo');
    await enviar();
    expect(
      await screen.findByText('Não deu para achar o local. Ligue a localização do celular e tente de novo, ou abra o Mapa e toque em "Relatar aqui".'),
    ).toBeTruthy();
    expect(screen.queryByText(/escolha o ponto no mapa/)).toBeNull();
  });
});
