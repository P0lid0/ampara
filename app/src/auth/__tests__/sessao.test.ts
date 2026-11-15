import * as SecureStore from 'expo-secure-store';
import { renderHook, act } from '@testing-library/react-native';
import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';
import { definirToken } from '../../api/cliente';
import { chamar } from '../../api/cliente';
import { aoSair, criarConta, entrar, entrarComoEmergencia, limparMotivoSaida, restaurar, sair, useMotivoSaida, useSessao } from '../sessao';

const fetchMock = jest.fn();
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
const amanha = () => new Date(Date.now() + 86_400_000).toISOString();

beforeEach(async () => {
  (jest.requireMock('expo-sqlite') as { __reiniciar: () => void }).__reiniciar();
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  await sair();
  jest.mocked(SecureStore.setItemAsync).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  definirToken(null);
});

describe('sessão', () => {
  it('login grava o token no SecureStore', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ampara.token', expect.stringContaining('jwt-1'));
    const { result } = await renderHook(() => useSessao());
    expect(result.current.autenticado).toBe(true);
    expect(result.current.escopo).toBe('usuario');
  });

  it('criarConta faz registrar + login', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ usuarioId: 'u1' }, 201))
      .mockResolvedValueOnce(json({ token: 'jwt-2', expiraEm: amanha() }));
    await criarConta('Ana Teste', 'ana@exemplo.test', 'senha-teste');
    expect(fetchMock.mock.calls.map(([u]) => new URL(u).pathname)).toEqual(['/api/v1/auth/registrar', '/api/v1/auth/login']);
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
  });

  it('restaurar recupera o token salvo e ignora token vencido', async () => {
    await SecureStore.setItemAsync('ampara.token', JSON.stringify({ token: 'velho', expiraEm: '2000-01-01T00:00:00Z' }));
    await restaurar();
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
    await SecureStore.setItemAsync('ampara.token', JSON.stringify({ token: 'bom', expiraEm: amanha() }));
    await restaurar();
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(true);
  });

  it('RF1: entrarComoEmergencia NÃO chama SecureStore.setItemAsync nem grava no SQLite', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-emerg', expiraEm: new Date(Date.now() + 1_800_000).toISOString() }));
    await entrarComoEmergencia('ana@exemplo.test', '123456', 'palavra-teste');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    const db = await abrirBanco();
    expect(await sessaoRepo(db).get('ampara.token')).toBeNull();
    const linhas = await db.all<{ n: number }>('SELECT COUNT(*) AS n FROM sessao');
    expect(linhas[0].n).toBe(0);
    expect((await renderHook(() => useSessao())).result.current.escopo).toBe('emergencia');
  });

  it('RF1: token de emergência expira: com fake timers, após expiraEm useSessao().autenticado === false', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(json({ token: 'jwt-emerg', expiraEm: new Date(Date.now() + 1_800_000).toISOString() }));
    await entrarComoEmergencia('ana@exemplo.test', '123456', 'palavra-teste');
    const { result } = await renderHook(() => useSessao());
    expect(result.current.autenticado).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_800_001);
    });
    expect(result.current.autenticado).toBe(false);
    const motivo = await renderHook(() => useMotivoSaida());
    expect(motivo.result.current).toBe('expirou');
  });

  it('401 em rota autenticada derruba a sessão com motivo "expirou"', async () => {
    fetchMock.mockResolvedValueOnce(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(chamar('/me')).rejects.toMatchObject({ status: 401 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
    expect((await renderHook(() => useMotivoSaida())).result.current).toBe('expirou');
    limparMotivoSaida();
    expect((await renderHook(() => useMotivoSaida())).result.current).toBeNull();
  });

  it('sair é robusta: falha no SecureStore não impede limpar o SQLite nem rodar os callbacks', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    const db = await abrirBanco();
    await sessaoRepo(db).set('qualquer', 'x');
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('falha simulada'));
    const cb = jest.fn();
    const remover = aoSair(cb);
    await expect(sair()).resolves.toBeUndefined();
    expect(await sessaoRepo(db).get('qualquer')).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
    remover();
    await sair();
    expect(cb).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it('sair apaga SecureStore, esvazia o SQLite e executa os callbacks de aoSair', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    const db = await abrirBanco();
    await sessaoRepo(db).set('qualquer', 'x');
    const cb = jest.fn();
    aoSair(cb);
    await sair();
    expect(await SecureStore.getItemAsync('ampara.token')).toBeNull();
    expect(await sessaoRepo(db).get('qualquer')).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
  });
});
