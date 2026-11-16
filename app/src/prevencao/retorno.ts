import type { BoStatus, Recuperacao } from '../api/tipos';

// A frase sobre o aplicativo oficial (SP Mobile) não consta em docs/fontes.md; fica a versão que a fonte sustenta.
export const TEXTO_ORIENTACAO = 'Para acompanhar sua ocorrência, guarde o protocolo e pergunte à delegacia.';

const ROTULOS_RETORNO: Record<string, string> = {
  recebida: 'Recebida pela polícia',
  em_analise: 'Em análise',
  atendida: 'Atendida',
  descartada: 'Arquivada pela polícia',
};

/** Status da Ponte em texto; um status que o app não conhece volta como veio. */
export function rotuloRetorno(status: string): string {
  return Object.hasOwn(ROTULOS_RETORNO, status) ? ROTULOS_RETORNO[status] : status;
}

export function rotuloBoStatus(s: BoStatus): string {
  return s === 'registrado' ? 'BO registrado' : 'BO ainda não registrado';
}

export function rotuloRecuperacao(r: Recuperacao): string {
  return r === 'recuperado' ? 'Celular recuperado' : r === 'localizado' ? 'Celular localizado' : 'Sem notícias do celular';
}

export const MSG_BO_NUMERO = 'Use até 30 letras, números, / ou -.';

/** Vazio vale (campo opcional); senão 1 a 30 caracteres entre letras, números, "/" e "-". */
export function validarBoNumero(t: string): boolean {
  return t === '' || /^[A-Za-z0-9/-]{1,30}$/.test(t);
}
