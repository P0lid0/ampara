const FORMATO = /^chaveiro-[a-z0-9]+(-[a-z0-9]+)*$/;
const MAXIMO = 40;

/** deviceId do chaveiro: minúsculas, números e hifens, começando em "chaveiro-", até 40 caracteres. */
export function deviceIdValido(s: string): boolean {
  return s.length <= MAXIMO && FORMATO.test(s);
}

/** Tempo que a tela espera o chaveiro aparecer conectado depois de parear. */
export const ESPERA_PAREAMENTO_MS = 20_000;
export const INTERVALO_PAREAMENTO_MS = 2_000;
