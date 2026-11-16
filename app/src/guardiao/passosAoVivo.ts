// Canal em memória dos PassoAtualizado do hub: o serviço do guardião emite, a tela do passo a passo ouve.
// Nada é gravado: o horário do passo já vem do servidor.
export type PassoAoVivo = { ocorrenciaId: string; passo: string; concluidoEm: string };

const ouvintes = new Set<(e: PassoAoVivo) => void>();

export function emitirPasso(e: PassoAoVivo): void {
  for (const o of [...ouvintes]) {
    try {
      o(e);
    } catch {
      // um ouvinte com defeito não impede os outros
    }
  }
}

/** Registra um ouvinte; devolve a função que o remove. */
export function ouvirPassos(o: (e: PassoAoVivo) => void): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}
