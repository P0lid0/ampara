// Fila offline da rota: todo ponto vai primeiro para o SQLite e só sai depois que o servidor aceitou o lote.
import { ApiErro } from '../api/cliente';
import type { Banco } from '../db/db';
import { rotaRepo, type PontoRota, type PontoRotaComId } from '../db/repos';

export const PRECISAO_MAX_M = 150;
export const RETENCAO_MS = 7 * 86_400_000;
export const LOTE_MAX = 500;
/** O servidor recusa `em` acima de agora+5 min; 4 min deixa folga para o tempo até o envio. */
export const FUTURO_MAX_MS = 4 * 60_000;
/** Folga no limite de 7 dias ao enviar: o ponto não pode vencer no caminho até o servidor. */
const FOLGA_PASSADO_MS = 60_000;

/** Normaliza para ISO-8601 UTC com Z; null se a data for inválida. */
function emUtc(em: string): string | null {
  const t = new Date(em).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Grava os pontos válidos e devolve quantos gravou. Descarta precisão acima de 150 m, pontos com mais de
 * 7 dias, pontos com data mais de 4 min no futuro (relógio adiantado) e valores inválidos; aproveita para
 * tirar da fila o que passou dos 7 dias.
 */
export async function registrarPontos(db: Banco, pts: PontoRota[]): Promise<number> {
  const agora = Date.now();
  const limite = agora - RETENCAO_MS;
  const validos: PontoRota[] = [];
  for (const p of pts) {
    if (![p.lat, p.lng, p.precisao].every(Number.isFinite) || p.precisao > PRECISAO_MAX_M) continue;
    const em = emUtc(p.em);
    if (!em) continue;
    const t = new Date(em).getTime();
    if (t < limite || t > agora + FUTURO_MAX_MS) continue;
    validos.push({ lat: p.lat, lng: p.lng, precisao: p.precisao, em });
  }
  const repo = rotaRepo(db);
  await repo.adicionar(validos);
  await repo.apagarMaisAntigosQue(new Date(limite).toISOString());
  return validos.length;
}

/** 400/422: o servidor recusou o conteúdo do lote (ex.: ponto-invalido); reenviar igual dá o mesmo erro. */
function recusaDefinitiva(e: unknown): boolean {
  return e instanceof ApiErro && (e.status === 400 || e.status === 422);
}

type Rodada = { enviados: number; parou: boolean };

/**
 * Envia um lote; se o servidor recusar o conteúdo, divide ao meio e tenta cada parte, até isolar o ponto
 * recusado, que sai da fila (sem dividir, um ponto ruim travaria a fila inteira). Qualquer outra falha
 * (sem rede, 401, 403, 408, 429, 5xx) para a rodada e mantém o lote para a próxima.
 */
async function enviarOuDividir(
  repo: ReturnType<typeof rotaRepo>,
  lote: PontoRotaComId[],
  enviar: (lote: PontoRota[]) => Promise<void>,
): Promise<Rodada> {
  try {
    await enviar(lote.map(({ lat, lng, precisao, em }) => ({ lat, lng, precisao, em })));
  } catch (e) {
    if (!recusaDefinitiva(e)) return { enviados: 0, parou: true };
    if (lote.length === 1) {
      await repo.remover([lote[0].id]);
      return { enviados: 0, parou: false };
    }
    const meio = Math.ceil(lote.length / 2);
    const a = await enviarOuDividir(repo, lote.slice(0, meio), enviar);
    if (a.parou) return a;
    const b = await enviarOuDividir(repo, lote.slice(meio), enviar);
    return { enviados: a.enviados + b.enviados, parou: b.parou };
  }
  await repo.remover(lote.map((p) => p.id));
  return { enviados: lote.length, parou: false };
}

/**
 * Envia a fila em lotes de até `max`, do mais antigo ao mais novo. Um lote só sai do banco depois de `enviar`
 * resolver; numa falha transitória para e mantém o resto (o mesmo lote é reenviado inteiro na próxima rodada, o
 * que é seguro porque o servidor descarta pontos repetidos de mesmo usuário e mesmo `em`). Antes de enviar, tira
 * da fila o que o servidor recusaria de qualquer jeito (mais de 7 dias ou data no futuro).
 */
export async function enviarPendentes(
  db: Banco,
  enviar: (lote: PontoRota[]) => Promise<void>,
  max: number = LOTE_MAX,
): Promise<{ enviados: number; restantes: number }> {
  const repo = rotaRepo(db);
  const agora = Date.now();
  await repo.apagarMaisAntigosQue(new Date(agora - RETENCAO_MS + FOLGA_PASSADO_MS).toISOString());
  await repo.apagarMaisNovosQue(new Date(agora + FUTURO_MAX_MS).toISOString());
  let enviados = 0;
  for (;;) {
    const lote = await repo.proximoLote(max);
    if (lote.length === 0) break;
    const r = await enviarOuDividir(repo, lote, enviar);
    enviados += r.enviados;
    if (r.parou || lote.length < max) break;
  }
  return { enviados, restantes: await repo.contar() };
}
