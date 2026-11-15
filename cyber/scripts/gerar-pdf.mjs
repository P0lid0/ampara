// Uso: node gerar-pdf.mjs
// Converte cyber/documentacao.md em HTML (marked), com a identidade visual do Ampara, e imprime em PDF A4 com o
// Edge ja instalado (page.pdf, printBackground). Saida: cyber/saida/Ampara-Cyber-Documentacao.pdf (fora do git).
// Sem degrade e sem position: sticky, que quebram no PDF.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";
import { abrirNavegador } from "./prints-navegador.mjs";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const saidaDir = resolve(raiz, "cyber/saida");
mkdirSync(saidaDir, { recursive: true });

// o HTML intermediario fica em cyber/saida/ (fora do git), com <base> apontando para as imagens do markdown.
const md = readFileSync(resolve(raiz, "cyber/documentacao.md"), "utf8");
const corpo = marked.parse(md, { gfm: true });

const css = `
@page { size: A4; margin: 18mm 16mm 20mm 16mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1d2b2a; background: #fff; }
h1 { font-size: 40pt; color: #114f4d; margin: 0 0 4pt; letter-spacing: -0.5pt; }
h2 { font-size: 17pt; color: #114f4d; border-bottom: 2.5pt solid #114f4d; padding-bottom: 3pt; margin: 18pt 0 8pt; break-after: avoid; }
h3 { font-size: 12.5pt; color: #16324f; margin: 14pt 0 5pt; break-after: avoid; }
h4 { font-size: 11pt; color: #16324f; margin: 10pt 0 4pt; break-after: avoid; }
p { margin: 5pt 0; }
a { color: #114f4d; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 9.2pt; background: #eef3f2; padding: 0 3pt; border-radius: 3pt; }
pre { background: #f4f6f8; border: 1pt solid #d6dde3; border-radius: 6pt; padding: 8pt 10pt; overflow: hidden; break-inside: avoid; white-space: pre-wrap; }
pre code { background: none; padding: 0; font-size: 8.6pt; }
blockquote { margin: 8pt 0; padding: 6pt 12pt; border-left: 4pt solid #114f4d; background: #eef3f2; color: #16324f; break-inside: avoid; }
blockquote p { margin: 2pt 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.2pt; break-inside: auto; }
tr { break-inside: avoid; }
th { background: #114f4d; color: #fff; text-align: left; padding: 4pt 6pt; }
td { border: 1pt solid #cfd8dc; padding: 4pt 6pt; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f6f9f8; }
img { display: block; max-width: 100%; max-height: 23cm; width: auto; height: auto; margin: 6pt auto; border: 1pt solid #d6dde3; border-radius: 4pt; }
td img { max-height: 9.5cm; }
p > img:only-child { break-inside: avoid; }
svg { display: block; width: 100%; height: auto; margin: 8pt 0; break-inside: avoid; }
.quebra { break-after: page; height: 0; }
.capa { padding-top: 60mm; break-inside: avoid; }
.capa-selo { color: #5a6b69; font-size: 10pt; text-transform: uppercase; letter-spacing: 1.5pt; margin: 0 0 8pt; }
.capa-lema { font-size: 14pt; color: #16324f; font-style: italic; margin: 0 0 22pt; }
.capa-titulo { font-size: 17pt; font-weight: 700; color: #114f4d; margin: 0 0 4pt; }
.capa-sub { font-size: 11pt; color: #3c4e4c; margin: 0 0 26pt; }
.capa table th { display: none; }
.capa table td:first-child { width: 28%; background: #eef3f2; }
.aviso-sintetico { margin-top: 24pt; padding: 8pt 12pt; border: 1.5pt solid #b5651d; background: #fff6ea; color: #5b3a12; border-radius: 6pt; }
`;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Ampara - Cyber Security: documentacao</title>
<base href="${pathToFileURL(resolve(raiz, "cyber") + "/").href}">
<style>${css}</style></head><body>${corpo}</body></html>`;
const arquivoHtml = resolve(saidaDir, "documentacao.html");
writeFileSync(arquivoHtml, html, "utf8");

const nav = await abrirNavegador();
try {
  const pg = await nav.newPage();
  await pg.goto(pathToFileURL(arquivoHtml).href, { waitUntil: "load" });
  await pg.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
  const quebradas = await pg.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")));
  if (quebradas.length) throw new Error("Imagens nao carregaram: " + quebradas.join(", "));
  const destino = resolve(saidaDir, "Ampara-Cyber-Documentacao.pdf");
  await pg.pdf({
    path: destino, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font:8px 'Segoe UI',Arial,sans-serif;color:#5a6b69;padding:0 16mm;display:flex;justify-content:space-between"><span>Ampara · Cyber Security · dados sintéticos</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
  });
  console.log(`ok ${destino} (${(corpo.match(/<img /g) ?? []).length} imagens)`);
} finally {
  await nav.close();
}
