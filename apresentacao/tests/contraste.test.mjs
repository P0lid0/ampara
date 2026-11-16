// Contraste dos pares de texto da página de apresentação (WCAG 2.x). Rode: node --test apresentacao/tests
import test from "node:test";
import assert from "node:assert/strict";

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const M = { petroleo: "#0F4C4A", fundo: "#0B3B39", esmeralda: "#14B88A", areia: "#F4EFE6", areiaEscura: "#E4DDCF",
  tinta: "#12201F", apoio: "#3D6563", alarme: "#E5484D", sobreAlarme: "#111111", alarmeTexto: "#B3202A",
  okFundo: "#EAF6F1", atencaoFundo: "#FFF6DB", atencaoTexto: "#8A5A00", branco: "#FFFFFF" };

// [texto, fundo, mínimo, onde]
const PARES = [
  ["tinta", "areia", 4.5, "texto corrido"],
  ["tinta", "areiaEscura", 4.5, "texto na seção dos 90 minutos"],
  ["apoio", "areia", 4.5, "legendas e créditos"],
  ["apoio", "areiaEscura", 4.5, "legendas sobre areia escura"],
  ["petroleo", "areia", 4.5, "números grandes e links"],
  ["petroleo", "areiaEscura", 4.5, "rótulos de tempo"],
  ["areia", "petroleo", 4.5, "texto do herói e da demo"],
  ["areia", "fundo", 4.5, "texto da simulação em repouso"],
  ["tinta", "esmeralda", 4.5, "botões e fechamento"],
  ["sobreAlarme", "alarme", 4.5, "alarme e simulação em alarme"],
  ["petroleo", "areia", 4.5, "botão Estou ciente"],
  ["petroleo", "okFundo", 4.5, "etiqueta roda hoje"],
  ["atencaoTexto", "atencaoFundo", 4.5, "etiqueta em construção"],
  ["alarmeTexto", "areiaEscura", 4.5, "rótulo 60 s na linha do tempo"],
  ["esmeralda", "petroleo", 3, "carimbo de hora (texto grande e em negrito, só 3:1 exigido)"],
  ["esmeralda", "fundo", 3, "idem, sobre o fundo da simulação"],
];

for (const [t, f, min, onde] of PARES) {
  test(`${t} sobre ${f} (${onde}) >= ${min}:1`, () => {
    const r = razao(M[t], M[f]);
    assert.ok(r >= min, `${t} ${M[t]} sobre ${f} ${M[f]} deu ${r.toFixed(2)}:1`);
  });
}
