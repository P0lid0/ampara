// Mock de expo-sqlite sobre node:sqlite (DatabaseSync em memória). Mesmo nome => mesmo banco,
// para testar reabertura; __reiniciar() zera tudo entre testes.
import { DatabaseSync } from 'node:sqlite';

export type SQLiteBindValue = string | number | null | boolean | Uint8Array;

const bancos = new Map<string, DatabaseSync>();

const bind = (p: SQLiteBindValue[] = []) => p.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)) as never[];

export async function openDatabaseAsync(nome: string) {
  let db = bancos.get(nome);
  if (!db) {
    db = new DatabaseSync(':memory:');
    bancos.set(nome, db);
  }
  const d = db;
  return {
    execAsync: async (sql: string) => {
      d.exec(sql);
    },
    runAsync: async (sql: string, p: SQLiteBindValue[] = []) => {
      const r = d.prepare(sql).run(...bind(p));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllAsync: async <T>(sql: string, p: SQLiteBindValue[] = []) =>
      d.prepare(sql).all(...bind(p)).map((l) => ({ ...l })) as T[],
    getFirstAsync: async <T>(sql: string, p: SQLiteBindValue[] = []) => {
      const l = d.prepare(sql).get(...bind(p));
      return (l ? { ...l } : null) as T | null;
    },
    closeAsync: async () => {
      d.close();
      bancos.delete(nome);
    },
  };
}

export function __reiniciar() {
  for (const d of bancos.values()) d.close();
  bancos.clear();
}
