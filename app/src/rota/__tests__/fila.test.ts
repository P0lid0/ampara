import { abrirBanco, type Banco } from '../../db/db';
import { rotaRepo, type PontoRota } from '../../db/repos';
import { ApiErro } from '../../api/cliente';
import { enviarPendentes, registrarPontos } from '../fila';

let db: Banco;
let seq = 0;

beforeEach(async () => {
  (jest.requireMock('expo-sqlite') as { __reiniciar: () => void }).__reiniciar();
  db = await abrirBanco(`fila-${++seq}.db`);
});

const MIN = 60_000;
const DIA = 86_400_000;

// SINTETICO: coordenadas fixas de teste (perto de Pinheiros), nunca dado real.
const ponto = (msAtras: number, i = 0, precisao = 10): PontoRota => ({
  lat: -23.5672 + i * 1e-5,
  lng: -46.7019,
  precisao,
  em: new Date(Date.now() - msAtras).toISOString(),
});

/** n pontos das últimas horas, do mais antigo ao mais novo, um por segundo. */
const pontos = (n: number): PontoRota[] => Array.from({ length: n }, (_, i) => ponto((n - i) * 1000, i));

const contarLinhas = async () => (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM rota_pendente'))?.n ?? 0;

describe('fila da rota', () => {
  it('1200 pontos pendentes → enviar chamado com lotes de 500, 500 e 200 e fila vazia', async () => {
    expect(await registrarPontos(db, pontos(1200))).toBe(1200);
    const enviar = jest.fn(async (_lote: PontoRota[]) => undefined);
    const r = await enviarPendentes(db, enviar);
    expect(enviar.mock.calls.map(([l]) => l.length)).toEqual([500, 500, 200]);
    expect(r).toEqual({ enviados: 1200, restantes: 0 });
    expect(await contarLinhas()).toBe(0);
  });

  it('o lote enviado tem só os campos do contrato (sem o id local)', async () => {
    await registrarPontos(db, [ponto(MIN)]);
    const enviar = jest.fn(async (_lote: PontoRota[]) => undefined);
    await enviarPendentes(db, enviar);
    expect(Object.keys(enviar.mock.calls[0][0][0]).sort()).toEqual(['em', 'lat', 'lng', 'precisao']);
  });

  it('RF2: falha no 2º lote → enviados 500, restantes 700 e as 700 linhas continuam no banco', async () => {
    await registrarPontos(db, pontos(1200));
    const enviar = jest
      .fn<Promise<void>, [PontoRota[]]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('rede'));
    const r = await enviarPendentes(db, enviar);
    expect(enviar).toHaveBeenCalledTimes(2); // parou na primeira falha
    expect(r).toEqual({ enviados: 500, restantes: 700 });
    expect(await contarLinhas()).toBe(700);
  });

  it('RF2: ponto com precisao 300 não é gravado; ponto de 8 dias não é gravado', async () => {
    const gravados = await registrarPontos(db, [ponto(MIN, 0, 300), ponto(8 * DIA, 1), ponto(MIN, 2, 150), ponto(6 * DIA, 3)]);
    expect(gravados).toBe(2);
    const fila = await rotaRepo(db).proximoLote();
    expect(fila.map((p) => p.precisao)).toEqual([10, 150]);
  });

  it('ponto com coordenada ou data inválida não é gravado', async () => {
    const ok = ponto(MIN);
    const gravados = await registrarPontos(db, [
      { ...ok, lat: Number.NaN },
      { ...ok, precisao: Number.POSITIVE_INFINITY },
      { ...ok, em: 'ontem' },
      ok,
    ]);
    expect(gravados).toBe(1);
  });

  it('RF2: todo "em" gravado termina em Z (UTC)', async () => {
    // mesmo instante escrito com fuso de Brasília: tem de virar UTC com Z
    const local = new Date(Date.now() - MIN);
    const comFuso = new Date(local.getTime() - 3 * 3_600_000).toISOString().replace('Z', '-03:00');
    await registrarPontos(db, [ponto(2 * MIN), { ...ponto(0), em: comFuso }]);
    const ems = (await rotaRepo(db).proximoLote()).map((p) => p.em);
    expect(ems).toHaveLength(2);
    for (const em of ems) expect(em).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(ems[1]).toBe(local.toISOString());
  });

  it('pontos saem ordenados por em mesmo gravados fora de ordem', async () => {
    const ordem = pontos(30);
    const embaralhado = [...ordem].reverse();
    [embaralhado[3], embaralhado[17]] = [embaralhado[17], embaralhado[3]];
    await registrarPontos(db, embaralhado.slice(0, 15));
    await registrarPontos(db, embaralhado.slice(15));
    const enviar = jest.fn(async (_lote: PontoRota[]) => undefined);
    await enviarPendentes(db, enviar, 10);
    const enviados = enviar.mock.calls.flatMap(([l]) => l.map((p) => p.em));
    expect(enviados).toEqual(ordem.map((p) => p.em));
  });

  it('resposta perdida: o lote foi aceito pelo servidor mas o app não viu o 202; na próxima rodada o MESMO lote é reenviado inteiro (o servidor descarta pontos repetidos de mesmo usuário e mesmo em, então é seguro) e só então sai da fila', async () => {
    await registrarPontos(db, pontos(300));
    const servidor: PontoRota[][] = [];
    const enviar = jest
      .fn<Promise<void>, [PontoRota[]]>()
      .mockImplementationOnce(async (lote) => {
        servidor.push(lote); // o servidor gravou...
        throw new Error('timeout'); // ...mas a resposta não chegou
      })
      .mockImplementationOnce(async (lote) => {
        servidor.push(lote);
      });

    expect(await enviarPendentes(db, enviar)).toEqual({ enviados: 0, restantes: 300 });
    expect(await contarLinhas()).toBe(300);

    expect(await enviarPendentes(db, enviar)).toEqual({ enviados: 300, restantes: 0 });
    expect(servidor).toHaveLength(2);
    expect(servidor[1]).toEqual(servidor[0]); // mesmo lote, inteiro
    expect(await contarLinhas()).toBe(0);
  });

  it('fila vazia não chama enviar', async () => {
    const enviar = jest.fn(async (_lote: PontoRota[]) => undefined);
    expect(await enviarPendentes(db, enviar)).toEqual({ enviados: 0, restantes: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  // Itens 5 e 20: o servidor recusa o lote inteiro (422 ponto-invalido) se um ponto estiver fora de
  // [agora-7d, agora+5min]; a fila não pode travar por causa de um ponto.
  it('item 5: ponto com "em" mais de 4 min no futuro (relógio adiantado) não é gravado', async () => {
    expect(await registrarPontos(db, [ponto(-10 * MIN), ponto(-3 * MIN, 1), ponto(MIN, 2)])).toBe(2);
    expect(await contarLinhas()).toBe(2);
  });

  it('item 5: antes de enviar, pontos que saíram da janela do servidor (mais de 7 dias ou no futuro) saem da fila', async () => {
    await rotaRepo(db).adicionar([
      { ...ponto(8 * DIA), lat: -23.1 },
      { ...ponto(-10 * MIN), lat: -23.2 },
      { ...ponto(MIN), lat: -23.3 },
    ]);
    const enviar = jest.fn(async (_lote: PontoRota[]) => undefined);
    const r = await enviarPendentes(db, enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].map((p) => p.lat)).toEqual([-23.3]);
    expect(r).toEqual({ enviados: 1, restantes: 0 });
  });

  it.each([422, 400])('item 20: %i num lote com um ponto recusado: o lote é dividido, os válidos vão e só o recusado sai da fila', async (status) => {
    const RUIM = -23.9999;
    const lista = pontos(10);
    lista[6] = { ...lista[6], lat: RUIM };
    await rotaRepo(db).adicionar(lista);
    const aceitos: number[] = [];
    const enviar = jest.fn(async (lote: PontoRota[]) => {
      if (lote.some((p) => p.lat === RUIM)) throw new ApiErro(status, 'Regra de negócio violada');
      aceitos.push(...lote.map((p) => p.lat));
    });
    const r = await enviarPendentes(db, enviar);
    expect(aceitos).toHaveLength(9);
    expect(aceitos).not.toContain(RUIM);
    expect(r).toEqual({ enviados: 9, restantes: 0 });
  });

  it('item 20: depois de dividir um lote cheio, a fila segue para o lote seguinte', async () => {
    const RUIM = -23.9999;
    const lista = pontos(12);
    lista[0] = { ...lista[0], lat: RUIM };
    await rotaRepo(db).adicionar(lista);
    const enviar = jest.fn(async (lote: PontoRota[]) => {
      if (lote.some((p) => p.lat === RUIM)) throw new ApiErro(422, 'Regra de negócio violada');
    });
    const r = await enviarPendentes(db, enviar, 5);
    expect(r).toEqual({ enviados: 11, restantes: 0 });
  });

  // Rodada pontual, item B: dividir até o ponto único em toda recusa fazia ~2N-1 POSTs (999 para 500 pontos).
  it('servidor recusa todo ponto: 500 pontos geram no máximo 50 POSTs e a fila termina sem os recusados', async () => {
    await rotaRepo(db).adicionar(pontos(500));
    const enviar = jest.fn(async (_lote: PontoRota[]) => {
      throw new ApiErro(422, 'Regra de negócio violada');
    });
    const r = await enviarPendentes(db, enviar);
    expect(enviar.mock.calls.length).toBeLessThanOrEqual(50);
    expect(r).toEqual({ enviados: 0, restantes: 0 });
    expect(await contarLinhas()).toBe(0);
  });

  it.each([0, 401, 403, 408, 429, 500, 503])('item 20: erro %i (transitório ou de sessão/consentimento) para e mantém o lote inteiro', async (status) => {
    await registrarPontos(db, pontos(3));
    const enviar = jest.fn(async (_lote: PontoRota[]) => {
      throw new ApiErro(status, 'falha');
    });
    const r = await enviarPendentes(db, enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ enviados: 0, restantes: 3 });
  });
});
