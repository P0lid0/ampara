import { api } from '../api/endpoints';
import { abrirBanco, type Banco } from '../db/db';
import { sessaoRepo } from '../db/repos';

export const PASSOS = ['conta', 'consentimento', 'imei', 'contas', 'guardioes', 'chaveiro', 'checklist', 'emergencia'] as const;
export type PassoOnboarding = (typeof PASSOS)[number];

const CHAVE = 'onboarding.concluidos';

/** Próximo passo na ordem fixa, ou 'fim' quando todos estão concluídos. */
export function proximoPasso(concluidos: ReadonlySet<PassoOnboarding>): PassoOnboarding | 'fim' {
  return PASSOS.find((p) => !concluidos.has(p)) ?? 'fim';
}

export function rotaDoPasso(p: PassoOnboarding): string {
  return `/onboarding/${p}`;
}

export function numeroDoPasso(p: PassoOnboarding): number {
  return PASSOS.indexOf(p) + 1;
}

export async function lerConcluidos(db: Banco): Promise<Set<PassoOnboarding>> {
  const bruto = await sessaoRepo(db).get(CHAVE);
  if (!bruto) return new Set();
  try {
    const lista: unknown = JSON.parse(bruto);
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.filter((x): x is PassoOnboarding => PASSOS.includes(x as PassoOnboarding)));
  } catch {
    return new Set();
  }
}

export async function concluirPasso(db: Banco, p: PassoOnboarding): Promise<void> {
  const atuais = await lerConcluidos(db);
  if (atuais.has(p)) return;
  atuais.add(p);
  await sessaoRepo(db).set(CHAVE, JSON.stringify([...atuais]));
}

/** Marca o passo sem nunca lançar: se o SQLite falhar, a reconciliação com o servidor cobre depois. Devolve se gravou. */
export async function concluirPassoSeguro(p: PassoOnboarding): Promise<boolean> {
  try {
    await concluirPasso(await abrirBanco(), p);
    return true;
  } catch {
    return false;
  }
}

// Consulta uma rota; falha de rede ou de servidor conta como "não sei" (undefined), nunca como "vazio".
async function tentar<T>(f: () => Promise<T>): Promise<T | undefined> {
  try {
    return await f();
  } catch {
    return undefined;
  }
}

/**
 * Alinha o SQLite com o que o servidor já sabe (app reinstalado, outro aparelho). Só ACRESCENTA passos
 * concluídos, nunca desmarca. Sem rede devolve o que está no SQLite. Do aparelho só conta quantos há:
 * o `imeiMascarado` nunca é lido nem gravado.
 */
export async function reconciliarComServidor(db: Banco): Promise<Set<PassoOnboarding>> {
  const concluidos = await lerConcluidos(db);
  const [me, aparelhos, contas, guardioes, chaveiros] = await Promise.all([
    tentar(() => api.me.obter()),
    tentar(() => api.aparelhos.listar()),
    tentar(() => api.contas.listar()),
    tentar(() => api.guardioes.listar()),
    tentar(() => api.chaveiros.listar()),
  ]);
  const achados: PassoOnboarding[] = [];
  if (me?.consentimentoRota) achados.push('consentimento');
  if (me?.emergenciaConfigurada) achados.push('emergencia');
  if (aparelhos && aparelhos.length >= 1) achados.push('imei');
  if (contas && contas.length >= 1) achados.push('contas');
  if (guardioes && guardioes.length >= 1) achados.push('guardioes');
  if (chaveiros && chaveiros.length >= 1) achados.push('chaveiro');
  for (const p of achados) {
    if (concluidos.has(p)) continue;
    concluidos.add(p);
    try {
      await concluirPasso(db, p);
    } catch {
      // falha ao gravar: o passo vale nesta sessão e será reconciliado de novo na próxima abertura
    }
  }
  return concluidos;
}
