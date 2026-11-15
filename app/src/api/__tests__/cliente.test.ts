import { ApiErro, aoExpirar, chamar, definirToken } from '../cliente';
import { api } from '../endpoints';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  definirToken(null);
  aoExpirar(() => undefined);
});

const json = (corpo: unknown, status = 200, tipo = 'application/json') =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': tipo } });

describe('cliente da API', () => {
  it('problem+json vira ApiErro com detalheCidadao e sem valor de dado', async () => {
    fetchMock.mockResolvedValue(
      json({ title: 'IMEI inválido', status: 422, detalheCidadao: 'Confira o número do IMEI.' }, 422, 'application/problem+json'),
    );
    const erro = (await api.aparelhos.criar({ imei: '000000000000000', marca: 'X', modelo: 'Y' }).catch((e) => e)) as ApiErro;
    expect(erro).toBeInstanceOf(ApiErro);
    expect(erro.status).toBe(422);
    expect(erro.titulo).toBe('IMEI inválido');
    expect(erro.detalheCidadao).toBe('Confira o número do IMEI.');
    expect(erro.message).not.toContain('000000000000000');
  });

  it('erro sem problem+json usa a frase padrão', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const erro = (await chamar('/me').catch((e) => e)) as ApiErro;
    expect(erro.detalheCidadao).toBe('Não foi possível concluir agora. Tente de novo.');
  });

  it('204 devolve undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.me.consentimentoRota(true)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/me\/consentimento-rota$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ aceito: true });
  });

  it('qualquer 2xx é sucesso: POST /ocorrencias/gatilho com 200 (já existe ocorrência Aberta) devolve a mesma ocorrenciaId, igual ao 201', async () => {
    fetchMock.mockResolvedValueOnce(json({ ocorrenciaId: 'oc-1' }, 201)).mockResolvedValueOnce(json({ ocorrenciaId: 'oc-1' }, 200));
    const a = await api.ocorrencias.gatilho('web');
    const b = await api.ocorrencias.gatilho('web');
    expect(a.ocorrenciaId).toBe('oc-1');
    expect(b.ocorrenciaId).toBe(a.ocorrenciaId);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/ocorrencias\/gatilho$/);
  });

  it('api.me.obter, api.aparelhos.listar e api.contas.listar chamam GET /me, GET /aparelhos e GET /contas e devolvem os campos do contrato (imeiMascarado vem pronto, o app não monta)', async () => {
    // SINTETICO: dados de teste
    const me = { usuarioId: 'u1', nome: 'Ana Teste', email: 'ana@exemplo.test', consentimentoRota: false, emergenciaConfigurada: true };
    const aparelhos = [{ id: 'a1', marca: 'Marca', modelo: 'M1', imeiMascarado: '***********7518' }];
    const contas = [{ id: 'c1', nome: 'Banco Teste', tipo: 'banco', telefone: '4004-0000', link: 'https://exemplo.test' }];
    fetchMock.mockResolvedValueOnce(json(me)).mockResolvedValueOnce(json(aparelhos)).mockResolvedValueOnce(json(contas));
    expect(await api.me.obter()).toEqual(me);
    expect((await api.aparelhos.listar())[0].imeiMascarado).toBe('***********7518');
    expect((await api.contas.listar())[0]).toEqual(contas[0]);
    const urls = fetchMock.mock.calls.map(([u, i]) => `${i.method} ${new URL(u).pathname}`);
    expect(urls).toEqual(['GET /api/v1/me', 'GET /api/v1/aparelhos', 'GET /api/v1/contas']);
  });

  it('401 em /me/consentimento-rota chama aoExpirar; 401 em /auth/login NÃO chama', async () => {
    const cb = jest.fn();
    aoExpirar(cb);
    fetchMock.mockImplementation(async () => new Response(null, { status: 401 }));
    await api.me.consentimentoRota(true).catch(() => undefined);
    expect(cb).toHaveBeenCalledTimes(1);
    await api.auth.login({ email: 'a@b.test', senha: 'x' }).catch(() => undefined);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('falha de rede vira ApiErro status 0 com "Sem conexão com a internet."', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const erro = (await chamar('/me').catch((e) => e)) as ApiErro;
    expect(erro).toBeInstanceOf(ApiErro);
    expect(erro.status).toBe(0);
    expect(erro.detalheCidadao).toBe('Sem conexão com a internet.');
  });

  it('envia Authorization: Bearer <token> quando definirToken foi chamado (e não em semAuth)', async () => {
    fetchMock.mockImplementation(async () => json({}));
    definirToken('tok-123');
    await chamar('/me');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
    await api.auth.login({ email: 'a@b.test', senha: 'x' });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('timeout de 15 s aborta e vira status 0', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(
        (_u: string, init: { signal: AbortSignal }) =>
          new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('abort')))),
      );
      const p = chamar("/me").catch((e) => e);
      await jest.advanceTimersByTimeAsync(15001);
      expect(((await p) as ApiErro).status).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
