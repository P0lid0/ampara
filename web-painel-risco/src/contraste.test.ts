import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function cor(nome: string): string {
  const m = css.match(new RegExp(`--${nome}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`variavel ${nome} ausente`);
  return m[1];
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function razao(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const css = readFileSync(resolve(process.cwd(), "src/estilos.css"), "utf-8");

test("farol vermelho: texto sobre o alarme tem contraste >= 4,5:1 (nunca branco)", () => {
  expect(css).toMatch(/\.farol-vermelho\s*\{[^}]*color:\s*var\(--sobre-alarme\)/);
  expect(razao(cor("sobre-alarme"), cor("alarme"))).toBeGreaterThanOrEqual(4.5);
});
test("texto de erro tem contraste >= 4,5:1 sobre areia e branco", () => {
  expect(css).toMatch(/\.erro\s*\{[^}]*color:\s*var\(--alarme-texto\)/);
  expect(razao(cor("alarme-texto"), cor("areia"))).toBeGreaterThanOrEqual(4.5);
  expect(razao(cor("alarme-texto"), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
});
test("amarelo do farol tem contraste >= 4,5:1 com texto branco", () => {
  expect(razao("#FFFFFF", cor("amarelo"))).toBeGreaterThanOrEqual(4.5);
});

// Pares novos do redesenho (DESIGN.md "A mão no ombro"): farol esmeralda e âmbar com tinta, texto de apoio, estados.
// Variáveis aqui são lidas de src/estilos.css; o teste falha se o CSS perder o token.
const pares: [string, string, string, number][] = [
  ["tinta sobre esmeralda (farol seguro)", "tinta", "esmeralda", 4.5],
  ["tinta sobre âmbar (farol atenção)", "tinta", "ambar", 4.5],
  ["texto de apoio sobre areia", "texto-apoio", "areia", 4.5],
  ["texto de apoio sobre branco", "texto-apoio", "#FFFFFF", 4.5],
  ["texto de apoio sobre areia-escura (trilho das abas)", "texto-apoio", "areia-escura", 4.5],
  ["alarme-texto sobre fundo-alerta", "alarme-texto", "fundo-alerta", 4.5],
  ["amarelo-texto sobre fundo-atencao (faixa DEMONSTRAÇÃO e aviso)", "amarelo", "fundo-atencao", 4.5],
  ["petróleo sobre fundo-ok", "petroleo", "fundo-ok", 4.5],
  ["petróleo sobre areia-escura (aba)", "petroleo", "areia-escura", 4.5],
  ["areia sobre petróleo (cabeçalho, aba ativa, botão)", "areia", "petroleo", 4.5],
  ["branco sobre petróleo-pressionado (botão em hover)", "#FFFFFF", "petroleo-pressionado", 4.5],
  ["petróleo sobre botão desabilitado", "petroleo", "desabilitado", 4.5],
  ["tinta sobre branco (bloco de próximo passo no farol vermelho)", "tinta", "#FFFFFF", 4.5],
  // não-texto (barras e colunas do gráfico, anel de foco): 3:1
  ["coluna atenuada do gráfico sobre branco (não-texto)", "petroleo-suave", "#FFFFFF", 3],
  ["anel de foco petróleo sobre areia (não-texto)", "petroleo", "areia", 3],
];
const c = (v: string) => (v.startsWith("#") ? v : cor(v));
test.each(pares)("contraste: %s", (_nome, a, b, minimo) => {
  expect(razao(c(a), c(b))).toBeGreaterThanOrEqual(minimo);
});
test("o farol usa as cores aprovadas: esmeralda+tinta, âmbar+tinta, alarme+#111", () => {
  expect(css).toMatch(/\.farol-verde\s*\{[^}]*background:\s*var\(--esmeralda\)[^}]*color:\s*var\(--tinta\)/);
  expect(css).toMatch(/\.farol-amarelo\s*\{[^}]*background:\s*var\(--ambar\)[^}]*color:\s*var\(--tinta\)/);
  expect(cor("alarme").toUpperCase()).toBe("#E5484D");
  expect(cor("petroleo").toUpperCase()).toBe("#0F4C4A");
  expect(cor("esmeralda").toUpperCase()).toBe("#14B88A");
  expect(cor("areia").toUpperCase()).toBe("#F4EFE6");
});
test("texto de apoio não usa opacity (cor própria testada)", () => {
  expect(css).not.toMatch(/opacity:\s*\.[0-9]/);
});

// Revisão final do plano 03 (painel-3): Global Constraints pedem texto >= 16 px.
test("nenhum texto abaixo de 16 px (1rem)", () => {
  for (const m of css.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)) {
    const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
    expect(px, m[0]).toBeGreaterThanOrEqual(16);
  }
});
