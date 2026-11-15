// Uso: node prints-codigo.mjs <arquivo> <linhaIni> <linhaFim> <saida.png>
// Renderiza o trecho (linhas ini..fim, 1-based, inclusive) com highlight.js e tira o print com o Edge.
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js";
import { abrirNavegador } from "./prints-navegador.mjs";

const [arquivo, ini, fim, saida] = process.argv.slice(2);
if (!arquivo || !ini || !fim || !saida) {
  console.error("Uso: node prints-codigo.mjs <arquivo> <linhaIni> <linhaFim> <saida.png>");
  process.exit(2);
}
const a = Number(ini), b = Number(fim);
if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a) {
  console.error("Intervalo de linhas invalido.");
  process.exit(2);
}

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const caminho = resolve(arquivo);
const linhas = readFileSync(caminho, "utf8").replace(/\r\n/g, "\n").split("\n");
if (b > linhas.length) {
  console.error(`O arquivo tem ${linhas.length} linhas; pedido ate ${b}.`);
  process.exit(2);
}
const trecho = linhas.slice(a - 1, b);
const ext = extname(caminho).slice(1).toLowerCase();
const lang = { cs: "csharp", ts: "typescript", tsx: "typescript", js: "javascript", mjs: "javascript", sh: "bash", txt: "plaintext", md: "markdown", json: "json", sql: "sql" }[ext] ?? "plaintext";
const html = hljs.highlight(trecho.join("\n"), { language: lang }).value.split("\n");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const rotulo = esc(relative(raiz, caminho).replaceAll("\\", "/")) + `  (linhas ${a}–${b})`;
const largura = String(b).length;
const corpo = html
  .map((l, i) => `<div class="l"><span class="n">${String(a + i).padStart(largura, " ")}</span><span class="c">${l || " "}</span></div>`)
  .join("");

const pagina = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:Consolas,"Cascadia Mono",monospace}
#cartao{display:inline-block;min-width:760px;max-width:1100px;border:1px solid #cdd5df;border-radius:8px;overflow:hidden;background:#f8fafc}
.t{background:#16324f;color:#fff;font:600 14px "Segoe UI",Arial,sans-serif;padding:8px 14px}
pre{margin:0;padding:10px 0;font-size:14px;line-height:1.5}
.l{display:flex;white-space:pre-wrap;word-break:break-word}
.n{flex:none;color:#8a97a8;text-align:right;padding:0 12px;border-right:1px solid #dde3ea;margin-right:12px;user-select:none}
.c{flex:1;padding-right:14px;color:#1f2933}
.hljs-comment,.hljs-quote{color:#5f7a62;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-doctag{color:#0b5cad;font-weight:600}
.hljs-string,.hljs-regexp,.hljs-meta .hljs-string{color:#a3411d}
.hljs-number{color:#7a3e9d}
.hljs-title,.hljs-title.class_,.hljs-title.function_,.hljs-built_in,.hljs-type{color:#0a6b5d}
.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-params{color:#244a6f}
.hljs-meta,.hljs-subst{color:#6b4b00}
</style><body><div id="cartao"><div class="t">${rotulo}</div><pre>${corpo}</pre></div></body></html>`;

const nav = await abrirNavegador();
try {
  const pg = await nav.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 2 });
  await pg.setContent(pagina);
  mkdirSync(dirname(resolve(saida)), { recursive: true });
  await pg.locator("#cartao").screenshot({ path: resolve(saida) });
  console.log(`ok ${saida} (${rotulo.replace(/&[a-z]+;/g, "")})`);
} finally {
  await nav.close();
}
