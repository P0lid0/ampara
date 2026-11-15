// Migrações do banco local (spec 7.3), aplicadas em ordem; a versão fica em PRAGMA user_version.
// Não existe tabela de aparelho/IMEI: o app não guarda identificador do aparelho.
export const MIGRACOES: string[] = [
  `
  CREATE TABLE IF NOT EXISTS sessao (chave TEXT PRIMARY KEY NOT NULL, valor TEXT);
  CREATE TABLE IF NOT EXISTS guardiao (guardiao_id TEXT PRIMARY KEY NOT NULL, nome TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS chaveiro (device_id TEXT PRIMARY KEY NOT NULL, online INTEGER NOT NULL DEFAULT 0, bateria INTEGER, visto_em TEXT);
  CREATE TABLE IF NOT EXISTS ocorrencia (
    id TEXT PRIMARY KEY NOT NULL,
    estado TEXT NOT NULL,
    origem TEXT NOT NULL,
    iniciada_em TEXT NOT NULL,
    momento_em TEXT,
    vitima_nome TEXT,
    atualizado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS passo (
    ocorrencia_id TEXT NOT NULL,
    passo TEXT NOT NULL,
    concluido_em TEXT,
    PRIMARY KEY (ocorrencia_id, passo)
  );
  CREATE TABLE IF NOT EXISTS evento_recebido (event_id TEXT PRIMARY KEY NOT NULL, recebido_em INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS rota_pendente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL, lng REAL NOT NULL, precisao REAL NOT NULL, em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rota_pendente_em ON rota_pendente (em);
  CREATE TABLE IF NOT EXISTS relato_pendente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL, lat REAL, lng REAL, em TEXT NOT NULL, texto TEXT
  );
  `,
];

export const TABELAS = [
  'sessao',
  'guardiao',
  'chaveiro',
  'ocorrencia',
  'passo',
  'evento_recebido',
  'rota_pendente',
  'relato_pendente',
] as const;
