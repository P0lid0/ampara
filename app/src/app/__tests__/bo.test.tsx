import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import Bo from '../bo';
import { ApiErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';

jest.setTimeout(60000);

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('../../api/endpoints', () => ({
  api: { ocorrencias: { bo: jest.fn(), compartilharPolicia: jest.fn(), retorno: jest.fn() } },
}));

const bo = jest.mocked(api.ocorrencias.bo);
const compartilhar = jest.mocked(api.ocorrencias.compartilharPolicia);
const retorno = jest.mocked(api.ocorrencias.retorno);
const setString = jest.mocked(Clipboard.setStringAsync);

// SINTETICO: IMEI e texto de BO de teste.
const IMEI = '490154203237518';
const BO = {
  texto: `Comunico o roubo de um celular, IMEI ${IMEI}, em 12/11 às 17:41.`,
  delegacia: { nome: '1ª Delegacia Demo', endereco: 'Rua Demo, 100', lat: -23.55, lng: -46.63 },
  linkDelegaciaEletronica: 'https://example.com/delegacia-eletronica',
};
const AUTORIZO = 'Autorizo enviar esta ocorrência, sem meus dados pessoais, à polícia';

let abrirUrl: jest.SpyInstance;
beforeEach(() => {
  mockParams = { ocorrenciaId: 'oc-1' };
  bo.mockReset().mockResolvedValue(BO);
  compartilhar.mockReset().mockResolvedValue({ protocolo: 'PP-2026-000001' });
  retorno.mockReset().mockRejectedValue(new ApiErro(404, 'não encontrado'));
  setString.mockClear();
  abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('tela do BO', () => {
  it('BO: "Copiar texto" chama Clipboard.setStringAsync com exatamente o texto devolvido pela API', async () => {
    await render(<Bo />);
    expect(await screen.findByText(BO.texto)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Copiar texto'));
    expect(setString).toHaveBeenCalledWith(BO.texto);
    expect(await screen.findByText('Texto copiado.')).toBeTruthy();
  });

  it('BO: abre a Delegacia Eletrônica e a delegacia no mapa (geo:)', async () => {
    await render(<Bo />);
    await screen.findByText(BO.texto);
    expect(screen.getByText('1ª Delegacia Demo')).toBeTruthy();
    expect(screen.getByText('Rua Demo, 100')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Abrir a Delegacia Eletrônica'));
    expect(abrirUrl).toHaveBeenCalledWith('https://example.com/delegacia-eletronica');
    await fireEvent.press(screen.getByLabelText('Ver no mapa'));
    expect(abrirUrl).toHaveBeenCalledWith(`geo:-23.55,-46.63?q=-23.55,-46.63(${encodeURIComponent('1ª Delegacia Demo')})`);
  });

  it('BO: "Enviar à polícia" fica desabilitado até marcar o consentimento; depois chama compartilharPolicia(id) e mostra "Protocolo PP-2026-000001"', async () => {
    await render(<Bo />);
    await screen.findByText(BO.texto);
    const enviar = () => screen.getByLabelText('Enviar à polícia');
    expect(enviar().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(enviar());
    expect(compartilhar).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText(AUTORIZO));
    expect(enviar().props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(enviar());
    expect(compartilhar).toHaveBeenCalledWith('oc-1');
    expect(await screen.findByText('Protocolo PP-2026-000001')).toBeTruthy();
  });

  it('RF5: o texto do BO (com IMEI) não é gravado no SQLite nem em SecureStore e some do estado ao sair da tela', async () => {
    const logs = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error'), jest.spyOn(console, 'info')];
    const tela = await render(<Bo />);
    await screen.findByText(BO.texto);
    await fireEvent.press(screen.getByLabelText('Copiar texto'));
    await tela.unmount();

    const db = await abrirBanco();
    const tabelas = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const { name } of tabelas) {
      const linhas = await db.all<Record<string, unknown>>(`SELECT * FROM "${name}"`);
      expect(JSON.stringify(linhas)).not.toContain(IMEI);
    }
    const memoria = (jest.requireMock('expo-secure-store') as { __memoria: Map<string, string> }).__memoria;
    expect(JSON.stringify([...memoria.entries()])).not.toContain(IMEI);
    for (const l of logs) expect(JSON.stringify(l.mock.calls)).not.toContain(IMEI);

    // ao voltar à tela o texto é buscado de novo: não ficou guardado em lugar nenhum
    bo.mockClear();
    await render(<Bo />);
    await screen.findByText(BO.texto);
    expect(bo).toHaveBeenCalledTimes(1);
  });

  it('BO com erro 5xx mostra o detalheCidadao da IA em vez de "Error 500"', async () => {
    bo.mockRejectedValue(new ApiErro(500, 'Error 500', 'Error 500', 'Não conseguimos montar o texto agora. Tente de novo em instantes.'));
    await render(<Bo />);
    expect(await screen.findByText(/Não conseguimos montar o texto agora/)).toBeTruthy();
    expect(screen.queryByText(/Error 500/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Tentar de novo'));
    await waitFor(() => expect(bo).toHaveBeenCalledTimes(2));
  });

  it('erro ao enviar à polícia mostra a mensagem e mantém o botão disponível', async () => {
    compartilhar.mockRejectedValue(new ApiErro(502, 'x', undefined, 'A polícia não respondeu. Tente de novo.'));
    await render(<Bo />);
    await screen.findByText(BO.texto);
    await fireEvent.press(screen.getByLabelText(AUTORIZO));
    await fireEvent.press(screen.getByLabelText('Enviar à polícia'));
    expect(await screen.findByText(/A polícia não respondeu/)).toBeTruthy();
    expect(screen.getByLabelText('Enviar à polícia').props.accessibilityState.disabled).toBe(false);
  });
});
