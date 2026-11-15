import { transacao, type Banco } from './db';
import { TABELAS } from './schema';

/** ISO-8601 UTC com Z (contrato L1). */
export type PontoRota = { lat: number; lng: number; precisao: number; em: string };
export type PontoRotaComId = PontoRota & { id: number };

export type OcorrenciaLocal = {
  id: string;
  estado: string;
  origem: string;
  iniciadaEm: string;
  momentoEm: string | null;
  vitimaNome: string | null;
  atualizadoEm: string;
};

export type PassoLocal = { passo: string; concluidoEm: string | null };

export type RelatoPendente = { tipo: string; lat: number | null; lng: number | null; em: string; texto: string | null };
export type RelatoPendenteComId = RelatoPendente & { id: number };

export function sessaoRepo(db: Banco) {
  return {
    async get(chave: string): Promise<string | null> {
      return (await db.first<{ valor: string | null }>('SELECT valor FROM sessao WHERE chave = ?', [chave]))?.valor ?? null;
    },
    async set(chave: string, valor: string): Promise<void> {
      await db.run('INSERT INTO sessao (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', [chave, valor]);
    },
    /** Esvazia todas as tabelas (logout / apagar meus dados). */
    async apagarTudo(): Promise<void> {
      await transacao(db, async () => {
        for (const t of TABELAS) await db.exec(`DELETE FROM ${t}`);
        await db.exec('DELETE FROM sqlite_sequence');
      });
    },
  };
}

export function eventoRepo(db: Banco) {
  return {
    /** true se o evento é novo; false se já foi visto (idempotência do SignalR/push). */
    async registrar(eventId: string, em: number = Date.now()): Promise<boolean> {
      const r = await db.run('INSERT OR IGNORE INTO evento_recebido (event_id, recebido_em) VALUES (?, ?)', [eventId, em]);
      return r.changes === 1;
    },
  };
}

type LinhaOcorrencia = {
  id: string;
  estado: string;
  origem: string;
  iniciada_em: string;
  momento_em: string | null;
  vitima_nome: string | null;
  atualizado_em: string;
};

const paraOcorrencia = (l: LinhaOcorrencia): OcorrenciaLocal => ({
  id: l.id,
  estado: l.estado,
  origem: l.origem,
  iniciadaEm: l.iniciada_em,
  momentoEm: l.momento_em,
  vitimaNome: l.vitima_nome,
  atualizadoEm: l.atualizado_em,
});

export function ocorrenciaRepo(db: Banco) {
  return {
    async upsert(o: OcorrenciaLocal): Promise<void> {
      await db.run(
        `INSERT INTO ocorrencia (id, estado, origem, iniciada_em, momento_em, vitima_nome, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, origem = excluded.origem,
           iniciada_em = excluded.iniciada_em, momento_em = excluded.momento_em,
           vitima_nome = excluded.vitima_nome, atualizado_em = excluded.atualizado_em`,
        [o.id, o.estado, o.origem, o.iniciadaEm, o.momentoEm, o.vitimaNome, o.atualizadoEm],
      );
    },
    async listar(): Promise<OcorrenciaLocal[]> {
      return (await db.all<LinhaOcorrencia>('SELECT * FROM ocorrencia ORDER BY iniciada_em DESC, id DESC')).map(paraOcorrencia);
    },
    async obter(id: string): Promise<OcorrenciaLocal | null> {
      const l = await db.first<LinhaOcorrencia>('SELECT * FROM ocorrencia WHERE id = ?', [id]);
      return l ? paraOcorrencia(l) : null;
    },
    async marcarPasso(id: string, passo: string, concluidoEm: string): Promise<void> {
      await db.run(
        `INSERT INTO passo (ocorrencia_id, passo, concluido_em) VALUES (?, ?, ?)
         ON CONFLICT(ocorrencia_id, passo) DO UPDATE SET concluido_em = excluded.concluido_em`,
        [id, passo, concluidoEm],
      );
    },
    async passos(id: string): Promise<PassoLocal[]> {
      const ls = await db.all<{ passo: string; concluido_em: string | null }>(
        'SELECT passo, concluido_em FROM passo WHERE ocorrencia_id = ? ORDER BY passo',
        [id],
      );
      return ls.map((l) => ({ passo: l.passo, concluidoEm: l.concluido_em }));
    },
  };
}

export function rotaRepo(db: Banco) {
  return {
    async adicionar(pts: PontoRota[]): Promise<void> {
      if (pts.length === 0) return;
      await transacao(db, async () => {
        for (const p of pts) {
          await db.run('INSERT INTO rota_pendente (lat, lng, precisao, em) VALUES (?, ?, ?, ?)', [p.lat, p.lng, p.precisao, p.em]);
        }
      });
    },
    async proximoLote(max = 500): Promise<PontoRotaComId[]> {
      return db.all<PontoRotaComId>('SELECT id, lat, lng, precisao, em FROM rota_pendente ORDER BY em ASC, id ASC LIMIT ?', [max]);
    },
    async remover(ids: number[]): Promise<void> {
      // Em blocos de 500: o SQLite limita o número de parâmetros por comando.
      for (let i = 0; i < ids.length; i += 500) {
        const bloco = ids.slice(i, i + 500);
        await db.run(`DELETE FROM rota_pendente WHERE id IN (${bloco.map(() => '?').join(',')})`, bloco);
      }
    },
    async contar(): Promise<number> {
      return (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM rota_pendente'))?.n ?? 0;
    },
    async apagarTudo(): Promise<void> {
      await db.run('DELETE FROM rota_pendente');
    },
    /** `isoUtc` em ISO-8601 UTC com Z; a comparação textual vale porque o formato é fixo. */
    async apagarMaisAntigosQue(isoUtc: string): Promise<void> {
      await db.run('DELETE FROM rota_pendente WHERE em < ?', [isoUtc]);
    },
  };
}

export function relatoRepo(db: Banco) {
  return {
    async adicionar(r: RelatoPendente): Promise<number> {
      const res = await db.run('INSERT INTO relato_pendente (tipo, lat, lng, em, texto) VALUES (?, ?, ?, ?, ?)', [r.tipo, r.lat, r.lng, r.em, r.texto]);
      return res.lastInsertRowId;
    },
    async listar(): Promise<RelatoPendenteComId[]> {
      return db.all<RelatoPendenteComId>('SELECT id, tipo, lat, lng, em, texto FROM relato_pendente ORDER BY id ASC');
    },
    async remover(id: number): Promise<void> {
      await db.run('DELETE FROM relato_pendente WHERE id = ?', [id]);
    },
  };
}
