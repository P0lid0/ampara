import { abrirBanco, migrar, type Banco } from '../db';
import { MIGRACOES, TABELAS } from '../schema';
import { eventoRepo, ocorrenciaRepo, relatoRepo, rotaRepo, sessaoRepo, type PontoRota } from '../repos';

let db: Banco;
let nome = '';
let seq = 0;

beforeEach(async () => {
  (jest.requireMock('expo-sqlite') as { __reiniciar: () => void }).__reiniciar();
  // nome único por teste: garante banco limpo mesmo que o mock reaproveite conexões pelo nome
  nome = `teste-${++seq}.db`;
  db = await abrirBanco(nome);
});

// SINTETICO: coordenadas fixas de teste, nunca dado real.
const ponto = (em: string, i = 0): PontoRota => ({ lat: -23.5 + i * 1e-4, lng: -46.6, precisao: 8, em });

describe('banco local', () => {
  it('migrações são idempotentes (abrir 2x não falha, user_version = MIGRACOES.length)', async () => {
    await sessaoRepo(db).set('k', 'v');
    const deNovo = await abrirBanco(nome);
    const v = await deNovo.first<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(MIGRACOES.length);
    expect(await sessaoRepo(deNovo).get('k')).toBe('v');
  });

  it('evento repetido 5x: registrar devolve [true,false,false,false,false] e há 1 linha', async () => {
    const repo = eventoRepo(db);
    const rs: boolean[] = [];
    for (let i = 0; i < 5; i++) rs.push(await repo.registrar('evt-1', 1000 + i));
    expect(rs).toEqual([true, false, false, false, false]);
    expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM evento_recebido'))?.n).toBe(1);
  });

  it('proximoLote(500) devolve no máximo 500, em ordem de em, e remover(ids) apaga só eles', async () => {
    const repo = rotaRepo(db);
    const pts: PontoRota[] = [];
    // inseridos em ordem inversa para provar a ordenação por em
    for (let i = 599; i >= 0; i--) pts.push(ponto(new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(), i));
    await repo.adicionar(pts);
    const lote = await repo.proximoLote(500);
    expect(lote).toHaveLength(500);
    const ems = lote.map((p) => p.em);
    expect([...ems].sort()).toEqual(ems);
    expect(ems[0]).toBe('2026-11-01T00:00:00.000Z');
    await repo.remover(lote.map((p) => p.id));
    expect(await repo.contar()).toBe(100);
    const resto = await repo.proximoLote();
    expect(resto[0].em).toBe('2026-11-01T00:08:20.000Z');
  });

  it('apagarMaisAntigosQue remove pontos de 8 dias e mantém os de 6', async () => {
    const repo = rotaRepo(db);
    const agora = Date.UTC(2026, 10, 15, 12);
    const dia = 86_400_000;
    await repo.adicionar([ponto(new Date(agora - 8 * dia).toISOString()), ponto(new Date(agora - 6 * dia).toISOString())]);
    await repo.apagarMaisAntigosQue(new Date(agora - 7 * dia).toISOString());
    const sobrou = await repo.proximoLote();
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0].em).toBe(new Date(agora - 6 * dia).toISOString());
  });

  it('sessaoRepo.apagarTudo esvazia todas as 8 tabelas', async () => {
    expect(TABELAS).toHaveLength(8);
    await sessaoRepo(db).set('token', 'x');
    await db.run('INSERT INTO guardiao (guardiao_id, nome, ordem) VALUES (?, ?, ?)', ['g1', 'Guardiã Teste', 0]);
    await db.run('INSERT INTO chaveiro (device_id, online, bateria, visto_em) VALUES (?, ?, ?, ?)', ['d1', 1, 90, '2026-11-15T00:00:00Z']);
    await ocorrenciaRepo(db).upsert({
      id: 'o1', estado: 'Aberta', origem: 'App', iniciadaEm: '2026-11-15T00:00:00Z',
      momentoEm: null, vitimaNome: 'Vítima Teste', atualizadoEm: '2026-11-15T00:00:00Z',
    });
    await ocorrenciaRepo(db).marcarPasso('o1', 'ligar190', '2026-11-15T00:01:00Z');
    await eventoRepo(db).registrar('e1');
    await rotaRepo(db).adicionar([ponto('2026-11-15T00:00:00Z')]);
    await relatoRepo(db).adicionar({ tipo: 'suspeito', lat: -23.5, lng: -46.6, em: '2026-11-15T00:00:00Z', texto: 'teste' });
    for (const t of TABELAS) {
      expect((await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))?.n).toBeGreaterThan(0);
    }
    await sessaoRepo(db).apagarTudo();
    for (const t of TABELAS) {
      expect((await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))?.n).toBe(0);
    }
  });

  it('sqlite_master não contém tabela com nome aparelho ou imei', async () => {
    const nomes = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((l) => l.name.toLowerCase());
    expect(nomes.filter((n) => n.includes('aparelho') || n.includes('imei'))).toEqual([]);
    for (const t of TABELAS) expect(nomes).toContain(t);
  });

  it('ocorrência: upsert atualiza, listar traz a mais nova primeiro, passos são idempotentes', async () => {
    const repo = ocorrenciaRepo(db);
    const base = { origem: 'Chaveiro', momentoEm: null, vitimaNome: null, atualizadoEm: '2026-11-15T00:00:00Z' };
    await repo.upsert({ ...base, id: 'a', estado: 'Aberta', iniciadaEm: '2026-11-14T10:00:00Z' });
    await repo.upsert({ ...base, id: 'b', estado: 'Aberta', iniciadaEm: '2026-11-15T10:00:00Z' });
    await repo.upsert({ ...base, id: 'a', estado: 'Encerrada', iniciadaEm: '2026-11-14T10:00:00Z' });
    expect((await repo.listar()).map((o) => o.id)).toEqual(['b', 'a']);
    expect((await repo.obter('a'))?.estado).toBe('Encerrada');
    expect(await repo.obter('nao-existe')).toBeNull();
    await repo.marcarPasso('a', 'p1', '2026-11-14T10:05:00Z');
    await repo.marcarPasso('a', 'p1', '2026-11-14T10:06:00Z');
    expect(await repo.passos('a')).toEqual([{ passo: 'p1', concluidoEm: '2026-11-14T10:06:00Z' }]);
  });

  it('relato: adicionar, listar e remover', async () => {
    const repo = relatoRepo(db);
    const id = await repo.adicionar({ tipo: 'iluminacao', lat: null, lng: null, em: '2026-11-15T00:00:00Z', texto: null });
    expect(await repo.listar()).toHaveLength(1);
    await repo.remover(id);
    expect(await repo.listar()).toEqual([]);
  });

  describe('transações', () => {
    const quebrarEm = (alvo: Banco, trecho: string): Banco => ({
      ...alvo,
      exec: (sql) => (sql.includes(trecho) ? Promise.reject(new Error('falha injetada')) : alvo.exec(sql)),
    });

    it('falha no meio de apagarTudo faz rollback e a conexão continua usável', async () => {
      await sessaoRepo(db).set('token', 'x');
      await eventoRepo(db).registrar('e1');
      await expect(sessaoRepo(quebrarEm(db, 'DELETE FROM evento_recebido')).apagarTudo()).rejects.toThrow('falha injetada');
      expect(await sessaoRepo(db).get('token')).toBe('x');
      expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM evento_recebido'))?.n).toBe(1);
      await sessaoRepo(db).apagarTudo();
      expect(await sessaoRepo(db).get('token')).toBeNull();
    });

    it('falha numa migração faz rollback, não grava user_version e a conexão continua usável', async () => {
      MIGRACOES.push('CREATE TABLE nova_ok (x INTEGER); INSERT INTO tabela_que_nao_existe VALUES (1);');
      try {
        await expect(migrar(db)).rejects.toThrow('tabela_que_nao_existe');
      } finally {
        MIGRACOES.pop();
      }
      const v = await db.first<{ user_version: number }>('PRAGMA user_version');
      expect(v?.user_version).toBe(MIGRACOES.length);
      expect(await db.first('SELECT name FROM sqlite_master WHERE name = ?', ['nova_ok'])).toBeNull();
      await sessaoRepo(db).set('k', 'v');
      expect(await sessaoRepo(db).get('k')).toBe('v');
    });

    it('adicionar e apagarTudo concorrentes não dão erro de transação aninhada', async () => {
      const pts = Array.from({ length: 20 }, (_, i) => ponto(new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(), i));
      const rs = await Promise.allSettled([
        rotaRepo(db).adicionar(pts),
        sessaoRepo(db).apagarTudo(),
        rotaRepo(db).adicionar(pts),
        sessaoRepo(db).apagarTudo(),
      ]);
      expect(rs.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
      expect(await rotaRepo(db).contar()).toBe(0);
    });
  });

  it('apagarTudo zera os IDs: o próximo ponto de rota volta a ter id 1', async () => {
    await rotaRepo(db).adicionar([ponto('2026-11-15T00:00:00.000Z'), ponto('2026-11-15T00:00:01.000Z')]);
    await sessaoRepo(db).apagarTudo();
    await rotaRepo(db).adicionar([ponto('2026-11-15T00:00:02.000Z')]);
    expect((await rotaRepo(db).proximoLote())[0].id).toBe(1);
  });

  it('remover com mais de 500 ids (501) atravessa dois blocos', async () => {
    const repo = rotaRepo(db);
    await repo.adicionar(Array.from({ length: 502 }, (_, i) => ponto(new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(), i)));
    const todos = await repo.proximoLote(1000);
    expect(todos).toHaveLength(502);
    await repo.remover(todos.slice(0, 501).map((p) => p.id));
    expect(await repo.contar()).toBe(1);
  });
});
