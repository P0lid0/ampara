import * as SQLite from 'expo-sqlite';
import { MIGRACOES } from './schema';

export interface Banco {
  exec(sql: string): Promise<void>;
  run(sql: string, p?: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  all<T>(sql: string, p?: unknown[]): Promise<T[]>;
  first<T>(sql: string, p?: unknown[]): Promise<T | null>;
}

type Bruto = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;
type Param = SQLite.SQLiteBindValue;

function envolver(bruto: Bruto): Banco {
  return {
    exec: (sql) => bruto.execAsync(sql),
    run: async (sql, p = []) => {
      const r = await bruto.runAsync(sql, p as Param[]);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: <T>(sql: string, p: unknown[] = []) => bruto.getAllAsync<T>(sql, p as Param[]),
    first: async <T>(sql: string, p: unknown[] = []) => (await bruto.getFirstAsync<T>(sql, p as Param[])) ?? null,
  };
}

const filas = new WeakMap<Banco, Promise<unknown>>();

/**
 * Executa `fn` numa transação (BEGIN/COMMIT, ROLLBACK em erro) e serializa as transações da mesma
 * conexão por uma fila de promessas: nunca há BEGIN aninhado nem transação zumbi.
 */
export function transacao<T>(db: Banco, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(db) ?? Promise.resolve();
  const executar = async (): Promise<T> => {
    await db.exec('BEGIN');
    try {
      const r = await fn();
      await db.exec('COMMIT');
      return r;
    } catch (e) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        // engole só o erro do rollback; o erro original é o que importa
      }
      throw e;
    }
  };
  const atual = anterior.then(executar, executar);
  filas.set(db, atual.catch(() => undefined));
  return atual;
}

/** Aplica as migrações pendentes, cada uma numa transação, e grava user_version. */
export async function migrar(db: Banco): Promise<void> {
  const atual = (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  for (let v = atual; v < MIGRACOES.length; v++) {
    await transacao(db, async () => {
      await db.exec(MIGRACOES[v]);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export async function abrirBanco(nome = 'ampara.db'): Promise<Banco> {
  const bruto = await SQLite.openDatabaseAsync(nome);
  const db = envolver(bruto);
  await migrar(db);
  return db;
}
