// Abre o Edge ja instalado (sem baixar navegador); se faltar, tenta o Chrome.
import { chromium } from "playwright-core";

export async function abrirNavegador() {
  const canais = ["msedge", "chrome"];
  let ultimo;
  for (const channel of canais) {
    try {
      return await chromium.launch({ channel });
    } catch (e) {
      ultimo = e;
    }
  }
  throw new Error(`Nem o Edge nem o Chrome puderam ser abertos: ${ultimo?.message ?? ultimo}`);
}
