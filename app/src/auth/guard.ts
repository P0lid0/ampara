import type { Escopo } from './sessao';

// No modo emergência (aparelho de outra pessoa) só existem Histórico, rota e BO.
const ROTAS_EMERGENCIA = ['historico', 'ocorrencia', 'rota', 'bo'];

/** Primeiro segmento que não é grupo do Expo Router: ['(tabs)','historico'] -> 'historico'. */
function rotaReal(segmentos: readonly string[]): string {
  return segmentos.find((s) => !(s.startsWith('(') && s.endsWith(')'))) ?? 'index';
}

/** Devolve a rota para onde redirecionar, ou null se a rota atual (segmentos do Expo Router) é permitida. */
export function destinoGuard(autenticado: boolean, escopo: Escopo | null, segmentos: readonly string[]): string | null {
  const rota = rotaReal(segmentos);
  const noEntrar = rota === 'entrar';
  if (!autenticado) return noEntrar ? null : '/entrar';
  if (escopo === 'emergencia') {
    if (noEntrar) return '/historico';
    return ROTAS_EMERGENCIA.includes(rota) ? null : '/historico';
  }
  return noEntrar ? '/' : null;
}
