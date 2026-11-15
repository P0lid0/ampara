import type { Escopo } from './sessao';

// No modo emergência (aparelho de outra pessoa) só existem Histórico, rota e BO.
const ROTAS_EMERGENCIA = ['historico', 'rota', 'bo'];

/** Devolve a rota para onde redirecionar, ou null se a rota atual (primeiro segmento) é permitida. */
export function destinoGuard(autenticado: boolean, escopo: Escopo | null, primeiroSegmento: string): string | null {
  const noEntrar = primeiroSegmento === 'entrar';
  if (!autenticado) return noEntrar ? null : '/entrar';
  if (escopo === 'emergencia') {
    if (noEntrar) return '/historico';
    return ROTAS_EMERGENCIA.includes(primeiroSegmento) ? null : '/historico';
  }
  return noEntrar ? '/' : null;
}
