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

/** Aplica as migrações pendentes, cada uma numa transação, e grava user_version. */
export async function migrar(db: Banco): Promise<void> {
  const atual = (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  for (let v = atual; v < MIGRACOES.length; v++) {
    await db.exec(`BEGIN;\n${MIGRACOES[v]}\nPRAGMA user_version = ${v + 1};\nCOMMIT;`);
  }
}

export async function abrirBanco(nome = 'ampara.db'): Promise<Banco> {
  const bruto = await SQLite.openDatabaseAsync(nome);
  const db = envolver(bruto);
  await migrar(db);
  return db;
}
