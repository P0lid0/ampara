// Relato (P2): o app só limita o que é seguro limitar (tipo, tamanho, uma linha, intervalo entre relatos e
// validade da fila). Quem decide o que é abuso ou dado pessoal é a API; o app mostra a resposta dela.
import type { Banco } from '../db/db';
import { relatoRepo, type RelatoPendente } from '../db/repos';

export const TIPOS_RELATO = ['roubo', 'furto', 'suspeita'] as const;
export type TipoRelato = (typeof TIPOS_RELATO)[number];
export const MAX_TEXTO = 140;
export const INTERVALO_MIN_MS = 2 * 60_000;
export const VALIDADE_PENDENTE_MS = 2 * 3_600_000;

export type ResultadoValidacao = { ok: true } | { ok: false; motivo: string };

const SEPARADORES = String.fromCharCode(0x2028, 0x2029);
const QUEBRA_DE_LINHA = new RegExp(`[\r\n${SEPARADORES}]`);
const QUEBRAS_SEGUIDAS = new RegExp(`[\r\n${SEPARADORES}]+`, "g");

/** Mantém só o que cabe no campo: uma linha, até 140 unidades, sem cortar um par substituto (emoji) ao meio. */
export function limitarTexto(t: string): string {
  let r = t.replace(QUEBRAS_SEGUIDAS, ' ').slice(0, MAX_TEXTO);
  const ultimo = r.charCodeAt(r.length - 1);
  if (ultimo >= 0xd800 && ultimo <= 0xdbff) r = r.slice(0, -1);
  return r;
}

export function validarRelato(r: { tipo: string; texto?: string }): ResultadoValidacao {
  if (!(TIPOS_RELATO as readonly string[]).includes(r.tipo)) return { ok: false, motivo: 'Escolha o que aconteceu.' };
  const texto = (r.texto ?? '').trim();
  if (QUEBRA_DE_LINHA.test(texto)) return { ok: false, motivo: 'Escreva em uma linha só.' };
  if (texto.length > MAX_TEXTO) return { ok: false, motivo: `Use até ${MAX_TEXTO} caracteres.` };
  return { ok: true };
}

/** Intervalo mínimo de 2 min entre relatos. Data inválida não trava; relógio que voltou segue barrando. */
export function podeEnviarRelato(ultimoEm: Date | null, agora: Date): boolean {
  if (!ultimoEm || Number.isNaN(ultimoEm.getTime())) return true;
  return agora.getTime() - ultimoEm.getTime() >= INTERVALO_MIN_MS;
}

/**
 * Envia a fila de relatos. Descarta o que passou de 2 h desde `em` (relato velho engana quem olha o mapa)
 * e o que não tem posição; mantém na falha. Sem rede (status 0) para; recusa do servidor não trava os outros.
 */
export async function enviarRelatos(
  db: Banco,
  enviar: (r: RelatoPendente) => Promise<void>,
  agora: Date = new Date(),
): Promise<{ enviados: number; descartados: number }> {
  const repo = relatoRepo(db);
  let enviados = 0;
  let descartados = 0;
  for (const { id, ...r } of await repo.listar()) {
    const quando = new Date(r.em).getTime();
    const velho = !Number.isFinite(quando) || agora.getTime() - quando > VALIDADE_PENDENTE_MS;
    if (velho || r.lat === null || r.lng === null) {
      await repo.remover(id);
      descartados++;
      continue;
    }
    try {
      await enviar(r);
    } catch (e) {
      if ((e as { status?: number })?.status === 0) break;
      continue;
    }
    await repo.remover(id);
    enviados++;
  }
  return { enviados, descartados };
}
