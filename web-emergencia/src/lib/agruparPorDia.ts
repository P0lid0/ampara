// Lógica pura da linha do tempo. Cópia de app/src/rota/linhaDoTempo.ts (dois pacotes sem workspace): sem imports.
export type Ponto = { lat: number; lng: number; em: string };
export type Dia = { dia: string; pontos: Ponto[] };

const FUSO = "America/Sao_Paulo";

/** Data civil (YYYY-MM-DD) do instante no fuso dado. "en-CA" formata como ano-mês-dia. */
function diaDe(emIso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(emIso),
  );
}

/** Dias do mais novo ao mais antigo; pontos de cada dia em ordem de `em`. O dia é o do fuso, não o do UTC. */
export function agruparPorDia(pts: Ponto[], tz: string = FUSO): Dia[] {
  const ordenados = [...pts].sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
  const porDia = new Map<string, Ponto[]>();
  for (const p of ordenados) {
    const d = diaDe(p.em, tz);
    const lista = porDia.get(d);
    if (lista) lista.push(p);
    else porDia.set(d, [p]);
  }
  return [...porDia.entries()]
    .map(([dia, pontos]) => ({ dia, pontos }))
    .sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));
}

/** Índice do ponto com `em` mais perto do instante (empate fica com o mais antigo); -1 se a lista é vazia. */
export function pontoMaisProximo(pts: Ponto[], instanteIso: string): number {
  const alvo = new Date(instanteIso).getTime();
  let melhor = -1;
  let menor = Infinity;
  pts.forEach((p, i) => {
    const d = Math.abs(new Date(p.em).getTime() - alvo);
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  });
  return melhor;
}

/** HH:mm no fuso dado. */
export function formatarHora(emIso: string, tz: string = FUSO): string {
  return new Date(emIso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
}
