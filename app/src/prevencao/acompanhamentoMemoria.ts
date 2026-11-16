// Último acompanhamento do BO salvo nesta execução do app, por ocorrência (item 19 da revisão).
// O GET /retorno dá 404 enquanto a ocorrência não foi enviada à polícia, e o GET da ocorrência não traz
// boNumero/boStatus/recuperacao: sem esta memória, reabrir a tela mostraria o formulário vazio e o próximo
// salvar apagaria o número do BO no servidor. Fica só em memória (nunca SQLite nem SecureStore) e some ao sair.
import type { BoStatus, Recuperacao } from '../api/tipos';
import { aoSair } from '../auth/sessao';

export type Acompanhamento = { boNumero: string; boStatus: BoStatus; recuperacao: Recuperacao };

const salvos = new Map<string, Acompanhamento>();

export function lembrarAcompanhamento(ocorrenciaId: string, a: Acompanhamento): void {
  salvos.set(ocorrenciaId, { ...a });
}

export function acompanhamentoLembrado(ocorrenciaId: string): Acompanhamento | undefined {
  const a = salvos.get(ocorrenciaId);
  return a ? { ...a } : undefined;
}

export function esquecerAcompanhamentos(): void {
  salvos.clear();
}

aoSair(() => esquecerAcompanhamentos());
