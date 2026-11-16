// Rodada pontual, item A: a sessão de A expira (o SQLite fica, decisão do controlador) e outra conta entra no
// mesmo aparelho. Os dados locais de A não podem ir com o token de B nem seguir ligados para B.
import notifee from '@notifee/react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { definirToken } from '../../api/cliente';
import { abrirBanco } from '../../db/db';
import { rotaRepo, sessaoRepo } from '../../db/repos';
import { ID_AVISO_SESSAO } from '../../guardiao/servico';
import { sincronizarAgora } from '../../rota/tarefa';
import { CHAVE_DONO, entrar, entrarComoEmergencia, sair, sessaoAtual } from '../sessao';

jest.setTimeout(60000);

// SINTETICO: contas e posições de teste, nunca dado real.
const USUARIOS: Record<string, string> = { 'ana@exemplo.test': 'usuario-a', 'bia@exemplo.test': 'usuario-b' };
const amanha = () => new Date(Date.now() + 86_400_000).toISOString();
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

const fetchMock = jest.fn();
let falharMe = false;
/** Corpos dos POST /rota/pontos, com o token que os levou. */
let envios: { token: string | null; corpo: unknown }[] = [];

// Servidor de mentira: o login devolve um token por conta; o GET /me responde de quem é o token.
function servidor(url: string, init?: RequestInit): Promise<Response> {
  const caminho = new URL(url).pathname.replace('/api/v1', '');
  const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? null;
  const token = auth ? auth.replace('Bearer ', '') : null;
  if (caminho === '/auth/login') {
    const { email } = JSON.parse(String(init?.body)) as { email: string };
    return Promise.resolve(json({ token: `jwt-${USUARIOS[email]}`, expiraEm: amanha() }));
  }
  if (caminho === '/auth/emergencia') return Promise.resolve(json({ token: 'jwt-emerg', expiraEm: amanha() }));
  if (caminho === '/me') {
    if (falharMe) return Promise.reject(new TypeError('Network request failed'));
    const usuarioId = token?.replace('jwt-', '') ?? '';
    return Promise.resolve(json({ usuarioId, nome: 'Pessoa Teste', email: 'x@exemplo.test', consentimentoRota: false, emergenciaConfigurada: true }));
  }
  if (caminho === '/rota/pontos') {
    envios.push({ token, corpo: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response(null, { status: 202 }));
  }
  return Promise.resolve(new Response(null, { status: 404 }));
}

const PONTO_DE_A = { lat: -23.567249, lng: -46.7019515, precisao: 10 };

/** A entra, liga a rota e o papel de guardião, guarda pontos e tem a sessão expirada. */
async function prepararDadosDeAEExpirar(): Promise<void> {
  await entrar('ana@exemplo.test', 'senha-teste');
  const db = await abrirBanco();
  const repo = sessaoRepo(db);
  await repo.set('rota.consentimento', 'sim');
  await repo.set('guardiao_ativo', '1');
  await repo.set('onboarding.concluidos', '["conta"]');
  await rotaRepo(db).adicionar([{ ...PONTO_DE_A, em: new Date(Date.now() - 60_000).toISOString() }]);
  await sair('expirou');
}

beforeEach(async () => {
  (jest.requireMock('expo-sqlite') as { __reiniciar: () => void }).__reiniciar();
  falharMe = false;
  envios = [];
  fetchMock.mockReset().mockImplementation(servidor);
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  await sair();
  jest.clearAllMocks();
  fetchMock.mockImplementation(servidor);
  // A tarefa da rota de A está registrada no aparelho.
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
});

afterEach(() => {
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
  definirToken(null);
});

describe('troca de conta depois de uma expiração', () => {
  it('o login grava no SQLite o dono dos dados locais (usuarioId do GET /me)', async () => {
    await entrar('ana@exemplo.test', 'senha-teste');
    expect(await sessaoRepo(await abrirBanco()).get(CHAVE_DONO)).toBe('usuario-a');
  });

  it('A expira e B entra: apaga a fila, o consentimento local e guardiao_ativo, para a rota e o guardião e não envia os pontos de A', async () => {
    await prepararDadosDeAEExpirar();
    jest.mocked(Location.stopLocationUpdatesAsync).mockClear();
    jest.mocked(notifee.stopForegroundService).mockClear();
    jest.mocked(notifee.cancelNotification).mockClear();

    await entrar('bia@exemplo.test', 'senha-teste');

    const db = await abrirBanco();
    const repo = sessaoRepo(db);
    expect(await rotaRepo(db).contar()).toBe(0);
    expect(await repo.get('rota.consentimento')).toBeNull();
    expect(await repo.get('guardiao_ativo')).toBeNull();
    expect(await repo.get('onboarding.concluidos')).toBeNull();
    expect(await repo.get(CHAVE_DONO)).toBe('usuario-b');
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('ampara-rota');
    expect(notifee.stopForegroundService).toHaveBeenCalled();
    // o aviso "Entre de novo para receber alarmes" era de A
    expect(notifee.cancelNotification).toHaveBeenCalledWith(ID_AVISO_SESSAO);
    expect(sessaoAtual()).toMatchObject({ autenticado: true, escopo: 'usuario' });

    await sincronizarAgora();
    expect(envios).toEqual([]);
  });

  it('a limpeza acontece antes de B ficar autenticado (nada sincroniza ou retoma com os dados de A)', async () => {
    await prepararDadosDeAEExpirar();
    let filaQuandoAutenticou = -1;
    // Simula a sincronização que roda assim que a sessão de B aparece.
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (k: string, v: string) => {
      filaQuandoAutenticou = await rotaRepo(await abrirBanco()).contar();
      (jest.requireMock('expo-secure-store') as { __memoria: Map<string, string> }).__memoria.set(k, v);
    });
    await entrar('bia@exemplo.test', 'senha-teste');
    expect(filaQuandoAutenticou).toBe(0);
  });

  it('A expira e A entra de novo: mantém a fila, o consentimento, guardiao_ativo e o onboarding, e envia os pontos guardados', async () => {
    await prepararDadosDeAEExpirar();
    jest.mocked(Location.stopLocationUpdatesAsync).mockClear();
    jest.mocked(notifee.stopForegroundService).mockClear();

    await entrar('ana@exemplo.test', 'senha-teste');

    const db = await abrirBanco();
    const repo = sessaoRepo(db);
    expect(await rotaRepo(db).contar()).toBe(1);
    expect(await repo.get('rota.consentimento')).toBe('sim');
    expect(await repo.get('guardiao_ativo')).toBe('1');
    expect(await repo.get('onboarding.concluidos')).toBe('["conta"]');
    expect(await repo.get(CHAVE_DONO)).toBe('usuario-a');
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(notifee.stopForegroundService).not.toHaveBeenCalled();

    await sincronizarAgora();
    expect(envios).toHaveLength(1);
    expect(envios[0].token).toBe('jwt-usuario-a');
    expect(envios[0].corpo).toEqual([expect.objectContaining({ lat: PONTO_DE_A.lat, lng: PONTO_DE_A.lng })]);
  });

  it('sem dono gravado (instalação antiga): grava quem entrou e mantém os dados', async () => {
    const db = await abrirBanco();
    await sessaoRepo(db).set('rota.consentimento', 'sim');
    await rotaRepo(db).adicionar([{ ...PONTO_DE_A, em: new Date().toISOString() }]);

    await entrar('bia@exemplo.test', 'senha-teste');

    expect(await sessaoRepo(db).get(CHAVE_DONO)).toBe('usuario-b');
    expect(await sessaoRepo(db).get('rota.consentimento')).toBe('sim');
    expect(await rotaRepo(db).contar()).toBe(1);
  });

  it('se o GET /me falha, o login falha sem guardar o token nem ativar a sessão (não dá para saber de quem são os dados)', async () => {
    await prepararDadosDeAEExpirar();
    falharMe = true;
    jest.mocked(SecureStore.setItemAsync).mockClear();
    await expect(entrar('bia@exemplo.test', 'senha-teste')).rejects.toBeTruthy();
    expect(sessaoAtual().autenticado).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(await rotaRepo(await abrirBanco()).contar()).toBe(1);
    expect(await sessaoRepo(await abrirBanco()).get(CHAVE_DONO)).toBe('usuario-a');
  });

  it('sessão de emergência não consulta nem grava o dono e não apaga os dados do dono do aparelho', async () => {
    await prepararDadosDeAEExpirar();
    await entrarComoEmergencia('bia@exemplo.test', '123456', 'palavra-teste');
    const db = await abrirBanco();
    expect(await sessaoRepo(db).get(CHAVE_DONO)).toBe('usuario-a');
    expect(await rotaRepo(db).contar()).toBe(1);
    expect(fetchMock.mock.calls.filter(([u]) => new URL(u).pathname.endsWith('/me'))).toHaveLength(1); // só o login de A
  });
});
