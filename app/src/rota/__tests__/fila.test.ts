import { abrirBanco, type Banco } from '../../db/db';
import { rotaRepo, type PontoRota } from '../../db/repos';
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
});
