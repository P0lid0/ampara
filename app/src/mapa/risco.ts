// Risco por área e faixa horária, relatos no mapa. Puro: o relógio entra sempre como parâmetro.
import type { Bbox, RiscoDto } from '../api/tipos';
import { areaLimites, areasNoBbox, type Limites } from './area';

export const ROTULO_SEM_DADO = 'Sem dado para esta área';
export const PINHEIROS = { lat: -23.567249, lng: -46.7019515 };
const DUAS_HORAS_MS = 2 * 60 * 60 * 1000;

// São Paulo fica em UTC-3 o ano todo (sem horário de verão desde 2019). A conta é feita à mão, sem Intl:
// no Hermes do release o Intl.DateTimeFormat nem sempre devolve as partes que o Node devolve, e dia ou faixa
// inválidos fazem a API recusar o /risco com 422 (a tela mostrava "Não deu para carregar o risco agora").
const DESLOCAMENTO_SP_MS = -3 * 60 * 60 * 1000;
const spDe = (d: Date) => new Date(d.getTime() + DESLOCAMENTO_SP_MS);

/** 0 = 00h–03h … 7 = 21h–24h, na hora de São Paulo. */
export function faixaDe(d: Date): number {
  return Math.floor(spDe(d).getUTCHours() / 3);
}

/** 0 = segunda … 6 = domingo, no dia de São Paulo. */
export function diaDe(d: Date): number {
  return (spDe(d).getUTCDay() + 6) % 7;
}

export function consultaRisco(b: Bbox, d: Date): { bbox: Bbox; dia: number; faixa: number } {
  return { bbox: b, dia: diaDe(d), faixa: faixaDe(d) };
}

export type ClasseRisco = 'baixo' | 'medio' | 'alto';
const ROTULOS: Record<ClasseRisco, string> = {
  baixo: 'Atenção normal',
  medio: 'Atenção redobrada',
  alto: 'Atenção máxima neste horário',
};
export const rotuloClasse = (c: ClasseRisco): string => ROTULOS[c];

/** Áreas que a API devolveu. Área fora deste conjunto é "sem dado", nunca "baixo". */
export function celulasComDado(resp: RiscoDto[]): Set<string> {
  return new Set(resp.map((r) => r.areaId));
}
export const semDado = (areaId: string, resp: RiscoDto[]): boolean => !celulasComDado(resp).has(areaId);

export type CelulaDoMapa = { areaId: string; classe: ClasseRisco | 'sem'; limites: Limites };
export const MAX_CELULAS_SEM_DADO = 400;

/**
 * Celulas a desenhar. As que a API devolveu entram com a classe que vieram (baixo continua baixo);
 * as que ela nao devolveu entram como 'sem' (cinza), nunca como baixo. Se a consulta falhou, ou se a
 * area visivel e grande demais (> 400 celulas), nenhuma 'sem' e desenhada: nao afirmar "sem dado" sem saber.
 */
export function celulasDoMapa(bbox: Bbox, resp: RiscoDto[], erroRede: boolean): CelulaDoMapa[] {
  const lista: CelulaDoMapa[] = [];
  for (const r of resp) {
    const limites = areaLimites(r.areaId);
    if (limites) lista.push({ areaId: r.areaId, classe: r.classe, limites });
  }
  if (erroRede) return lista;
  const ids = areasNoBbox(bbox);
  if (ids.length > MAX_CELULAS_SEM_DADO) return lista;
  const comDado = celulasComDado(resp);
  for (const id of ids) {
    const limites = areaLimites(id);
    if (limites && !comDado.has(id)) lista.push({ areaId: id, classe: 'sem', limites });
  }
  return lista;
}

export function idadeRelato(emIso: string, agora: Date): string {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(emIso).getTime()) / 60000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `há ${h} h ${resto} min` : `há ${h} h`;
}

/** Relato só aparece por menos de 2 h; data inválida some. */
export function relatoVisivel(emIso: string, agora: Date): boolean {
  const t = new Date(emIso).getTime();
  return Number.isFinite(t) && agora.getTime() - t < DUAS_HORAS_MS;
}

export const ROTULO_TIPO_RELATO: Record<string, string> = {
  roubo: 'Roubo',
  furto: 'Furto',
  suspeita: 'Atitude suspeita',
};
