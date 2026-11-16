// Grade de ~500 m sobre a capital (contrato, seção "Grade"): a mesma fórmula da API (C#) e do ML (Python).
// Puro: sem rede e sem relógio.
import type { Bbox } from '../api/tipos';

const LAT0 = -23.8;
const LNG0 = -46.83;
const LAT1 = -23.35; // limites superiores exclusivos
const LNG1 = -46.36;
export const ALTURA = 0.0045;
export const LARGURA = 0.0049;
const LINHAS = Math.ceil((LAT1 - LAT0) / ALTURA - 1e-9);
const COLUNAS = Math.ceil((LNG1 - LNG0) / LARGURA - 1e-9);

export type Limites = { minLat: number; minLng: number; maxLat: number; maxLng: number };

const rotulo = (linha: number, coluna: number) =>
  `g${String(linha).padStart(3, '0')}_${String(coluna).padStart(3, '0')}`;

/** `"g051_026"` para a célula que contém o ponto, ou `"fora"` fora da capital. */
export function areaId(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'fora';
  if (lat < LAT0 || lat >= LAT1 || lng < LNG0 || lng >= LNG1) return 'fora';
  return rotulo(Math.floor((lat - LAT0) / ALTURA), Math.floor((lng - LNG0) / LARGURA));
}

function posicao(id: string): { linha: number; coluna: number } | null {
  const m = /^g(\d{3})_(\d{3})$/.exec(id);
  if (!m) return null;
  const linha = Number(m[1]);
  const coluna = Number(m[2]);
  return linha < LINHAS && coluna < COLUNAS ? { linha, coluna } : null;
}

export function areaLimites(id: string): Limites | null {
  const p = posicao(id);
  if (!p) return null;
  const minLat = LAT0 + p.linha * ALTURA;
  const minLng = LNG0 + p.coluna * LARGURA;
  return { minLat, minLng, maxLat: minLat + ALTURA, maxLng: minLng + LARGURA };
}

export function areaCentro(id: string): { lat: number; lng: number } | null {
  const p = posicao(id);
  if (!p) return null;
  return { lat: LAT0 + (p.linha + 0.5) * ALTURA, lng: LNG0 + (p.coluna + 0.5) * LARGURA };
}

/** Ids das células que cobrem a área visível (recortada aos limites da capital). */
export function areasNoBbox(b: Bbox): string[] {
  const l0 = Math.max(0, Math.floor((b.minLat - LAT0) / ALTURA));
  const l1 = Math.min(LINHAS - 1, Math.floor((b.maxLat - LAT0) / ALTURA));
  const c0 = Math.max(0, Math.floor((b.minLng - LNG0) / LARGURA));
  const c1 = Math.min(COLUNAS - 1, Math.floor((b.maxLng - LNG0) / LARGURA));
  const ids: string[] = [];
  for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) ids.push(rotulo(l, c));
  return ids;
}
