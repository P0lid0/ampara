import * as SecureStore from 'expo-secure-store';
import { renderHook, act } from '@testing-library/react-native';
import { abrirBanco } from '../../db/db';
import { rotaRepo, sessaoRepo } from '../../db/repos';
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

  // Decisão do controlador (itens 4 e 8): expirar não é sair.
  it('sair("expirou") tira só o token: a fila da rota, o consentimento, o papel de guardião e o onboarding ficam no SQLite', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    const db = await abrirBanco();
    const repo = sessaoRepo(db);
    await repo.set('rota.consentimento', 'sim');
    await repo.set('guardiao_ativo', '1');
    await repo.set('onboarding.concluidos', '["conta"]');
    await rotaRepo(db).adicionar([{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    const cb = jest.fn();
    const remover = aoSair(cb);
    await sair('expirou');
    remover();
    expect(await SecureStore.getItemAsync('ampara.token')).toBeNull();
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
    expect(await repo.get('rota.consentimento')).toBe('sim');
    expect(await repo.get('guardiao_ativo')).toBe('1');
    expect(await repo.get('onboarding.concluidos')).toBe('["conta"]');
    expect(await rotaRepo(db).contar()).toBe(1);
    expect(cb).toHaveBeenCalledWith({ motivo: 'expirou', escopo: 'usuario' });
  });

  it('timer de 8 h vencido mantém a fila da rota (não apaga o SQLite)', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: new Date(Date.now() + 8 * 3_600_000).toISOString() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    const db = await abrirBanco();
    await sessaoRepo(db).set('rota.consentimento', 'sim');
    await rotaRepo(db).adicionar([{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(8 * 3_600_000 + 1);
    });
    expect((await renderHook(() => useMotivoSaida())).result.current).toBe('expirou');
    expect(await rotaRepo(db).contar()).toBe(1);
    expect(await sessaoRepo(db).get('rota.consentimento')).toBe('sim');
  });

  it('sair("manual") avisa os callbacks com o motivo e o escopo', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    const cb = jest.fn();
    const remover = aoSair(cb);
    await sair('manual');
    remover();
    expect(cb).toHaveBeenCalledWith({ motivo: 'manual', escopo: 'usuario' });
  });

  it('sair da sessão de emergência só limpa a memória: não apaga o SQLite nem o SecureStore do aparelho emprestado', async () => {
    const db = await abrirBanco();
    await sessaoRepo(db).set('dado-do-dono-do-aparelho', 'x');
    fetchMock.mockResolvedValue(json({ token: 'jwt-emerg', expiraEm: new Date(Date.now() + 1_800_000).toISOString() }));
    await entrarComoEmergencia('ana@exemplo.test', '123456', 'palavra-teste');
    jest.mocked(SecureStore.deleteItemAsync).mockClear();
    const cb = jest.fn();
    const remover = aoSair(cb);
    await sair('manual');
    remover();
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(await sessaoRepo(db).get('dado-do-dono-do-aparelho')).toBe('x');
    expect(cb).toHaveBeenCalledWith({ motivo: 'manual', escopo: 'emergencia' });
  });

  it('item 2: restaurar() chamado enquanto sair() apaga o token não reativa a sessão', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    let liberar: () => void = () => undefined;
    const original = jest.mocked(SecureStore.deleteItemAsync).getMockImplementation()!;
    jest.mocked(SecureStore.deleteItemAsync).mockImplementationOnce(
      (k: string) =>
        new Promise<void>((r) => {
          liberar = () => void original(k).then(r);
        }),
    );
    const saindo = sair('manual');
    await restaurar();
    liberar();
    await saindo;
    await restaurar();
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
    expect(await SecureStore.getItemAsync('ampara.token')).toBeNull();
  });

  it('item 2: restaurar() que já leu o token antes de sair() não reativa a sessão depois', async () => {
    fetchMock.mockResolvedValue(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    const gravado = await SecureStore.getItemAsync('ampara.token');
    let liberar: () => void = () => undefined;
    // a leitura começa com o token ainda gravado e só termina depois do logout
    jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(
      () =>
        new Promise<string | null>((r) => {
          liberar = () => r(gravado);
        }),
    );
    const lendo = restaurar();
    await sair('manual');
    liberar();
    await lendo;
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(false);
  });

  it('item 1: 401 atrasado de uma chamada feita com o token anterior não derruba a sessão nova', async () => {
    fetchMock.mockResolvedValueOnce(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    let responder: (r: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          responder = r;
        }),
    );
    const antiga = chamar('/me').catch((e) => e);
    await sair('manual');
    fetchMock.mockResolvedValueOnce(json({ token: 'jwt-2', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    responder(new Response(null, { status: 401 }));
    expect(await antiga).toMatchObject({ status: 401 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect((await renderHook(() => useSessao())).result.current.autenticado).toBe(true);
    expect((await renderHook(() => useMotivoSaida())).result.current).toBeNull();
  });

  it('item 1: 401 de uma chamada em voo depois do sair manual não vira "Sua sessão terminou"', async () => {
    fetchMock.mockResolvedValueOnce(json({ token: 'jwt-1', expiraEm: amanha() }));
    await entrar('ana@exemplo.test', 'senha-teste');
    let responder: (r: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          responder = r;
        }),
    );
    const antiga = chamar('/me').catch((e) => e);
    await sair('manual');
    responder(new Response(null, { status: 401 }));
    await antiga;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect((await renderHook(() => useMotivoSaida())).result.current).toBe('manual');
  });
});
