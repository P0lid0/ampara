// Uso: node prints-painel.mjs [pastaSaida]   (padrao: cyber/evidencias/prints)
// Pre-requisitos: API em http://localhost:5080 com AMPARA_DEMO=true e o painel (vite) em http://localhost:5174/painel-risco/.
// Zera o rastro da vitima de demonstracao, entra no painel, aciona os cenarios e salva os prints:
//   painel-verde (0), painel-amarelo (40), painel-amarelo-65, painel-vermelho (75) e painel-executiva (admin).
// Credenciais: as da demonstracao sintetica (README da API); podem ser trocadas por DEMO_SENHA.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirNavegador } from "./prints-navegador.mjs";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const saida = resolve(process.argv[2] ?? resolve(raiz, "cyber/evidencias/prints"));
const painel = process.env.PAINEL_URL ?? "http://localhost:5174/painel-risco/";
const senha = process.env.DEMO_SENHA ?? "Demo!2026-sintetico";
mkdirSync(saida, { recursive: true });

execFileSync("bash", [resolve(raiz, "cyber/scripts/zerar-demo.sh")], { stdio: "inherit" });

const nav = await abrirNavegador();
try {
  async function entrar(email) {
    const ctx = await nav.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2, locale: "pt-BR" });
    const pg = await ctx.newPage();
    await pg.goto(painel);
    await pg.getByLabel("E-mail").fill(email);
    await pg.getByLabel("Senha").fill(senha);
    await pg.getByRole("button", { name: "Entrar" }).click();
    return { ctx, pg };
  }
  const tirar = (pg, nome) => pg.screenshot({ path: resolve(saida, `${nome}.png`), fullPage: true });
  const esperaIndice = (pg, n) => pg.locator(".farol-indice").filter({ hasText: `${n}/100` }).waitFor({ timeout: 20000 });

  const { ctx: cidadao, pg } = await entrar("vitima@ampara.demo");
  await esperaIndice(pg, 0);
  await tirar(pg, "painel-verde");

  const passos = [
    ["Acesso indevido", 40, ["painel-amarelo"]],
    ["Senha na resposta pública", 65, ["painel-amarelo-65"]],
    ["Vazar CPF no log", 75, ["painel-vermelho"]],
  ];
  for (const [rotulo, indice, nomes] of passos) {
    await pg.getByRole("button", { name: rotulo }).click();
    await esperaIndice(pg, indice);
    await pg.locator(".mensagem").first().waitFor();
    for (const n of nomes) await tirar(pg, n);
    console.log(`ok ${rotulo} -> ${indice}/100`);
  }
  await cidadao.close();

  const { ctx: admin, pg: pa } = await entrar("admin@ampara.demo");
  await pa.getByRole("tab", { name: "Visão executiva" }).click();
  await pa.locator(".executiva-total").waitFor({ timeout: 20000 });
  await pa.locator(".barras").first().waitFor();
  await tirar(pa, "painel-executiva");
  console.log("ok visao executiva:", (await pa.locator(".executiva-total").innerText()).trim());
  await admin.close();
} finally {
  await nav.close();
}
