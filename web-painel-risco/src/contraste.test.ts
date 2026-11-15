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

// Revisão final do plano 03 (painel-3): Global Constraints pedem texto >= 16 px.
test("nenhum texto abaixo de 16 px (1rem)", () => {
  for (const m of css.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)) {
    const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
    expect(px, m[0]).toBeGreaterThanOrEqual(16);
  }
});
