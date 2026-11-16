import type { cores } from './tokens';

// Razão de contraste WCAG 2.x entre duas cores hexadecimais (#RGB ou #RRGGBB).
function canal(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Cor inválida: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function razaoContraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

// Todo par texto/fundo usado nos componentes precisa estar aqui (teste exige >= 4.5:1).
// Branco sobre esmeralda e branco sobre alarme ficam de fora de propósito: reprovam.
export const paresDeTexto: { nome: string; texto: keyof typeof cores; fundo: keyof typeof cores }[] = [
  { nome: 'tinta sobre areia', texto: 'tinta', fundo: 'areia' },
  { nome: 'areia sobre petróleo', texto: 'areia', fundo: 'petroleo' },
  { nome: 'tinta sobre esmeralda', texto: 'tinta', fundo: 'esmeralda' },
  { nome: 'sobreAlarme sobre alarme', texto: 'sobreAlarme', fundo: 'alarme' },
  { nome: 'petróleo sobre areia', texto: 'petroleo', fundo: 'areia' },
  { nome: 'tinta sobre branco', texto: 'tinta', fundo: 'branco' },
  { nome: 'petróleo sobre branco', texto: 'petroleo', fundo: 'branco' },
  { nome: 'textoSuave sobre areia', texto: 'textoSuave', fundo: 'areia' },
  { nome: 'textoSuave sobre branco', texto: 'textoSuave', fundo: 'branco' },
  { nome: 'textoSuave sobre areiaFunda', texto: 'textoSuave', fundo: 'areiaFunda' },
  { nome: 'tinta sobre areiaFunda', texto: 'tinta', fundo: 'areiaFunda' },
  { nome: 'petróleo sobre areiaFunda', texto: 'petroleo', fundo: 'areiaFunda' },
  { nome: 'tinta sobre esmeraldaSuave', texto: 'tinta', fundo: 'esmeraldaSuave' },
  { nome: 'petróleo sobre esmeraldaSuave', texto: 'petroleo', fundo: 'esmeraldaSuave' },
  { nome: 'alarmeTexto sobre areia', texto: 'alarmeTexto', fundo: 'areia' },
  { nome: 'alarmeTexto sobre branco', texto: 'alarmeTexto', fundo: 'branco' },
  { nome: 'alarmeTexto sobre areiaFunda', texto: 'alarmeTexto', fundo: 'areiaFunda' },
  { nome: 'alarmeTexto sobre alarmeSuave', texto: 'alarmeTexto', fundo: 'alarmeSuave' },
  { nome: 'tinta sobre alarmeSuave', texto: 'tinta', fundo: 'alarmeSuave' },
];

// Limites de controle e formas (WCAG 1.4.11, >= 3:1). Não são texto; o rótulo escrito identifica o controle.
export const paresNaoTexto: { nome: string; forma: keyof typeof cores | 'cinzaChave'; fundo: keyof typeof cores }[] = [
  { nome: 'areia sobre alarme (silhueta do botão do alarme)', forma: 'areia', fundo: 'alarme' },
  { nome: 'esmeralda sobre petróleo (botão no herói)', forma: 'esmeralda', fundo: 'petroleo' },
  { nome: 'cinzaChave sobre areia (trilho do interruptor)', forma: 'cinzaChave', fundo: 'areia' },
  { nome: 'petróleo sobre branco (contorno de campo)', forma: 'petroleo', fundo: 'branco' },
];

// Pares que reprovam de propósito: nunca entram em paresDeTexto (o teste confere que reprovam mesmo).
export const paresReprovados: { nome: string; texto: keyof typeof cores; fundo: keyof typeof cores }[] = [
  { nome: 'tinta sobre alarme', texto: 'tinta', fundo: 'alarme' },
  { nome: 'branco sobre alarme', texto: 'branco', fundo: 'alarme' },
  { nome: 'esmeralda sobre areia', texto: 'esmeralda', fundo: 'areia' },
  { nome: 'esmeralda sobre branco', texto: 'esmeralda', fundo: 'branco' },
  { nome: 'esmeralda sobre petróleo (como texto)', texto: 'esmeralda', fundo: 'petroleo' },
  { nome: 'petróleo sobre alarme', texto: 'petroleo', fundo: 'alarme' },
  { nome: 'alarme sobre areia (como texto)', texto: 'alarme', fundo: 'areia' },
];
