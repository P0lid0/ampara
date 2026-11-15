/** Tira espaços, hífens, pontos e barras (máscaras comuns de IMEI). */
export function limparImei(entrada: string): string {
  return entrada.replace(/[\s\-./]/g, '');
}

/** 15 dígitos, soma de Luhn múltipla de 10 e não todos iguais. */
export function imeiValido(entrada: string): boolean {
  const imei = limparImei(entrada);
  if (!/^\d{15}$/.test(imei)) return false;
  if (/^(\d)\1{14}$/.test(imei)) return false;
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    // Contando da direita, dobra-se o 2º, 4º, ... dígito (o último é o de controle e não dobra).
    let d = Number(imei[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

/** Valor lido de um código de barras: devolve o IMEI ou null (EAN-13 e texto livre não contam). */
export function extrairImeiDeCodigo(valor: string): string | null {
  const direto = limparImei(valor);
  if (imeiValido(direto)) return direto;
  for (const m of valor.match(/(?<!\d)\d{15}(?!\d)/g) ?? []) {
    if (imeiValido(m)) return m;
  }
  return null;
}
