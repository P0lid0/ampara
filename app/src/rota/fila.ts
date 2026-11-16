// Fila offline da rota: todo ponto vai primeiro para o SQLite e só sai depois que o servidor aceitou o lote.
import type { Banco } from '../db/db';
import { rotaRepo, type PontoRota } from '../db/repos';

export const PRECISAO_MAX_M = 150;
export const RETENCAO_MS = 7 * 86_400_000;
export const LOTE_MAX = 500;

/** Normaliza para ISO-8601 UTC com Z; null se a data for inválida. */
function emUtc(em: string): string | null {
  const t = new Date(em).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Grava os pontos válidos e devolve quantos gravou. Descarta precisão acima de 150 m, pontos com mais de
 * 7 dias e valores inválidos; aproveita para tirar da fila o que passou dos 7 dias.
 */
export async function registrarPontos(db: Banco, pts: PontoRota[]): Promise<number> {
  const limite = Date.now() - RETENCAO_MS;
  const validos: PontoRota[] = [];
  for (const p of pts) {
    if (![p.lat, p.lng, p.precisao].every(Number.isFinite) || p.precisao > PRECISAO_MAX_M) continue;
    const em = emUtc(p.em);
    if (!em || new Date(em).getTime() < limite) continue;
    validos.push({ lat: p.lat, lng: p.lng, precisao: p.precisao, em });
  }
  const repo = rotaRepo(db);
  await repo.adicionar(validos);
  await repo.apagarMaisAntigosQue(new Date(limite).toISOString());
  return validos.length;
}

/**
 * Envia a fila em lotes de até `max`, do mais antigo ao mais novo. Um lote só sai do banco depois de `enviar`
 * resolver; na primeira falha para e mantém o resto (o mesmo lote é reenviado inteiro na próxima rodada, o que
 * é seguro porque o servidor descarta pontos repetidos de mesmo usuário e mesmo `em`).
 */
export async function enviarPendentes(
  db: Banco,
  enviar: (lote: PontoRota[]) => Promise<void>,
  max: number = LOTE_MAX,
): Promise<{ enviados: number; restantes: number }> {
  const repo = rotaRepo(db);
  let enviados = 0;
  for (;;) {
    const lote = await repo.proximoLote(max);
    if (lote.length === 0) break;
    try {
      await enviar(lote.map(({ lat, lng, precisao, em }) => ({ lat, lng, precisao, em })));
    } catch {
      break;
    }
    await repo.remover(lote.map((p) => p.id));
    enviados += lote.length;
    if (lote.length < max) break;
  }
  return { enviados, restantes: await repo.contar() };
}
