import { api } from '../../api/endpoints';
import { abrirBanco, type Banco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';
import { concluirPasso, lerConcluidos, PASSOS, proximoPasso, reconciliarComServidor, type PassoOnboarding } from '../passos';

jest.setTimeout(60000);

jest.mock('../../api/endpoints', () => ({
  api: {
    me: { obter: jest.fn() },
    aparelhos: { listar: jest.fn() },
    contas: { listar: jest.fn() },
    guardioes: { listar: jest.fn() },
    chaveiros: { listar: jest.fn() },
  },
}));

const m = {
  me: jest.mocked(api.me.obter),
  aparelhos: jest.mocked(api.aparelhos.listar),
  contas: jest.mocked(api.contas.listar),
  guardioes: jest.mocked(api.guardioes.listar),
  chaveiros: jest.mocked(api.chaveiros.listar),
};

// SINTETICO: dados de teste, nunca de pessoa real.
const ME = { usuarioId: 'u1', nome: 'Ana Teste', email: 'ana@exemplo.test', consentimentoRota: true, emergenciaConfigurada: true };
const APARELHO = { id: 'a1', marca: 'Marca', modelo: 'Modelo', imeiMascarado: '***********7518' };

let db: Banco;
beforeEach(async () => {
  db = await abrirBanco();
  await sessaoRepo(db).apagarTudo(); // o mock de expo-sqlite guarda o banco entre testes do mesmo arquivo
  Object.values(m).forEach((f) => f.mockReset());
  m.me.mockResolvedValue({ ...ME, consentimentoRota: false, emergenciaConfigurada: false });
  m.aparelhos.mockResolvedValue([]);
  m.contas.mockResolvedValue([]);
  m.guardioes.mockResolvedValue([]);
  m.chaveiros.mockResolvedValue([]);
});

describe('proximoPasso', () => {
  it('proximoPasso segue a ordem e devolve "fim" com tudo concluído', () => {
    expect(PASSOS).toEqual(['conta', 'consentimento', 'imei', 'contas', 'guardioes', 'chaveiro', 'emergencia']);
    const feitos = new Set<PassoOnboarding>();
    const visitados: string[] = [];
    for (let i = 0; i < 10; i++) {
      const p = proximoPasso(feitos);
      visitados.push(p);
      if (p === 'fim') break;
      feitos.add(p);
    }
    expect(visitados).toEqual([...PASSOS, 'fim']);
  });

  it('pula passos já concluídos fora de ordem', () => {
    expect(proximoPasso(new Set<PassoOnboarding>(['conta', 'imei']))).toBe('consentimento');
  });
});

describe('persistência', () => {
  it('retoma depois de fechar o app: concluirPasso("conta") + lerConcluidos → proximoPasso é "consentimento"', async () => {
    await concluirPasso(db, 'conta');
    const reaberto = await abrirBanco(); // mesma base, como numa nova abertura
    expect(proximoPasso(await lerConcluidos(reaberto))).toBe('consentimento');
  });

  it('concluir duas vezes o mesmo passo não duplica', async () => {
    await concluirPasso(db, 'imei');
    await concluirPasso(db, 'imei');
    expect([...(await lerConcluidos(db))]).toEqual(['imei']);
  });
});

describe('reconciliarComServidor', () => {
  it('app reinstalado (SQLite vazio) com /me {consentimentoRota:true, emergenciaConfigurada:true}, /aparelhos com 1 item e /contas vazio → conclui consentimento, imei e emergencia e deixa contas pendente', async () => {
    m.me.mockResolvedValue(ME);
    m.aparelhos.mockResolvedValue([APARELHO]);
    const r = await reconciliarComServidor(db);
    expect(r).toEqual(new Set(['consentimento', 'imei', 'emergencia']));
    expect(r.has('contas')).toBe(false);
    expect(await lerConcluidos(db)).toEqual(new Set(['consentimento', 'imei', 'emergencia']));
  });

  it('conta guardiões e chaveiros pelo menos 1', async () => {
    m.guardioes.mockResolvedValue([{ guardiaoId: 'g1', nome: 'Gui', ordem: 1 }]);
    m.chaveiros.mockResolvedValue([{ deviceId: 'd1', online: true, bateria: 80, vistoEm: '2026-11-14T10:00:00Z' }]);
    m.contas.mockResolvedValue([{ id: 'c1', nome: 'Banco', tipo: 'banco', telefone: '0', link: 'https://exemplo.test' }]);
    const r = await reconciliarComServidor(db);
    expect(r).toEqual(new Set(['guardioes', 'chaveiro', 'contas']));
  });

  it('sem rede mantém o que o SQLite já tinha e não lança erro; nunca desmarca um passo', async () => {
    await concluirPasso(db, 'conta');
    await concluirPasso(db, 'imei');
    Object.values(m).forEach((f) => f.mockRejectedValue(new Error('sem rede')));
    const r = await reconciliarComServidor(db);
    expect(r).toEqual(new Set(['conta', 'imei']));
    expect(await lerConcluidos(db)).toEqual(new Set(['conta', 'imei']));
  });

  it('servidor dizendo "vazio" não desmarca passo já concluído no SQLite', async () => {
    await concluirPasso(db, 'imei'); // /aparelhos devolve [] no beforeEach
    expect((await reconciliarComServidor(db)).has('imei')).toBe(true);
  });

  it('uma rota que falha não impede as outras', async () => {
    m.me.mockRejectedValue(new Error('500'));
    m.aparelhos.mockResolvedValue([APARELHO]);
    expect(await reconciliarComServidor(db)).toEqual(new Set(['imei']));
  });

  it('reconciliarComServidor nunca grava imeiMascarado no SQLite (só conta quantos aparelhos há)', async () => {
    m.aparelhos.mockResolvedValue([APARELHO]);
    await reconciliarComServidor(db);
    const tabelas = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    for (const { name } of tabelas) {
      const linhas = await db.all<Record<string, unknown>>(`SELECT * FROM ${name}`);
      expect(JSON.stringify(linhas)).not.toContain('7518');
      expect(JSON.stringify(linhas)).not.toContain('imeiMascarado');
    }
  });
});
