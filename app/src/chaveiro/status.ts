import type { ChaveiroDto } from '../api/tipos';

export const LIMITE_OFFLINE_S = 90;
export const BATERIA_BAIXA = 15;
export const INTERVALO_AVISO_BATERIA_MS = 6 * 3600_000;

export type RotuloStatus = { texto: string; estado: 'online' | 'offline'; bateriaBaixa: boolean };

function vistoRecente(vistoEm: string, agora: Date): boolean {
  const t = Date.parse(vistoEm);
  if (Number.isNaN(t)) return false;
  return agora.getTime() - t <= LIMITE_OFFLINE_S * 1000;
}

function bateriaConhecida(c: ChaveiroDto): number | null {
  return typeof c.bateria === 'number' && Number.isFinite(c.bateria) ? c.bateria : null;
}

/** Offline se o servidor diz offline ou se o último sinal tem mais de 90 s. */
export function rotuloStatus(c: ChaveiroDto | null, agora: Date): RotuloStatus {
  if (!c) return { texto: 'Nenhum chaveiro pareado.', estado: 'offline', bateriaBaixa: false };
  const estado = c.online && vistoRecente(c.vistoEm, agora) ? 'online' : 'offline';
  const bateria = bateriaConhecida(c);
  const bateriaBaixa = bateria !== null && bateria < BATERIA_BAIXA;
  const frasePilha =
    bateria === null ? 'Bateria: não informada' : bateriaBaixa ? `Bateria baixa (${bateria}%)` : `Bateria: ${bateria}%`;
  const frasePresenca = estado === 'online' ? 'Conectado' : 'Sem conexão';
  return { texto: `${frasePresenca}. ${frasePilha}`, estado, bateriaBaixa };
}

/** Bateria abaixo de 15% e nenhum aviso nas últimas 6 h. */
export function deveAvisarBateria(c: ChaveiroDto, ultimoAvisoEm: Date | null, agora: Date): boolean {
  const bateria = bateriaConhecida(c);
  if (bateria === null || bateria >= BATERIA_BAIXA) return false;
  if (!ultimoAvisoEm) return true;
  return agora.getTime() - ultimoAvisoEm.getTime() > INTERVALO_AVISO_BATERIA_MS;
}
