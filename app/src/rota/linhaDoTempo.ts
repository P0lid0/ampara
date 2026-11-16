// Linha do tempo da rota (P1): agrupa os pontos por dia no fuso do cidadão, acha o ponto mais perto de um
// instante e formata a hora. Puro: sem rede e sem relógio.
export type PontoDaRota = { lat: number; lng: number; em: string };
export type DiaDaRota = { dia: string; pontos: PontoDaRota[] };

export const FUSO_PADRAO = 'America/Sao_Paulo';

/** Partes de data/hora de um instante ISO no fuso informado. */
function partes(emIso: string, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const mapa: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(emIso))) mapa[p.type] = p.value;
  return mapa;
}

/** `HH:mm` no fuso informado (padrão: São Paulo). */
export function formatarHora(emIso: string, tz: string = FUSO_PADRAO): string {
  const p = partes(emIso, tz);
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

/** Dia (`YYYY-MM-DD`) de um instante no fuso informado. */
export function diaNoFuso(emIso: string, tz: string = FUSO_PADRAO): string {
  const p = partes(emIso, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Agrupa por dia do fuso: dias do mais novo ao mais antigo, pontos em ordem de `em`. Não altera a entrada. */
export function agruparPorDia(pts: readonly PontoDaRota[], tz: string = FUSO_PADRAO): DiaDaRota[] {
  const ordenados = pts.filter((p) => !Number.isNaN(Date.parse(p.em))).sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
  const porDia = new Map<string, PontoDaRota[]>();
  for (const p of ordenados) {
    const dia = diaNoFuso(p.em, tz);
    const lista = porDia.get(dia);
    if (lista) lista.push(p);
    else porDia.set(dia, [p]);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dia, pontos]) => ({ dia, pontos }));
}

/** Índice do ponto com `em` mais perto do instante (empate fica com o mais antigo); -1 se a lista é vazia. */
export function pontoMaisProximo(pts: readonly PontoDaRota[], instanteIso: string): number {
  const alvo = Date.parse(instanteIso);
  let melhor = -1;
  let menor = Infinity;
  pts.forEach((p, i) => {
    const d = Math.abs(Date.parse(p.em) - alvo);
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  });
  return melhor;
}
