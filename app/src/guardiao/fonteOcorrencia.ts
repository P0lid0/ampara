// Fonte dos dados do passo a passo do guardião: a API de verdade, ou, para ocorrências "demo-…",
// o SQLite local (a demonstração funciona sem servidor e sem rede).
import { api } from '../api/endpoints';
import type { OcorrenciaDto, Passo } from '../api/tipos';
import type { Banco } from '../db/db';
import { ocorrenciaRepo } from '../db/repos';

export const ORDEM_PASSOS: Passo[] = ['Banco', 'CelularSeguro', 'Operadora', 'Senhas', 'Bo'];

export interface FonteOcorrencia {
  carregar(id: string): Promise<{ ocorrencia: OcorrenciaDto }>;
  concluirPasso(id: string, passo: Passo): Promise<{ concluidoEm: string }>;
}

/**
 * "(11) 4004-0000" -> "tel:1140040000". Só dígitos, "*" e "#" (códigos curtos como *611) e um + inicial:
 * nada do texto da conta vira comando. O "#" vai como %23 para não virar fragmento da URL. Telefone ausente
 * (o catálogo real traz null na maioria das contas) ou sem nenhum dígito devolve null: não há o que ligar.
 */
export function urlTelefone(t: string | null | undefined): string | null {
  const limpo = (t ?? '').trim();
  const numero = limpo.replace(/[^\d*#]/g, '').replace(/#/g, '%23');
  if (!/\d/.test(numero)) return null;
  return `tel:${limpo.startsWith('+') ? '+' : ''}${numero}`;
}

export const fonteApi: FonteOcorrencia = {
  async carregar(id) {
    return { ocorrencia: await api.ocorrencias.obter(id) };
  },
  async concluirPasso(id, passo) {
    await api.ocorrencias.concluirPasso(id, passo);
    return { concluidoEm: new Date().toISOString() };
  },
};

// SINTETICO: contas e telefones de demonstração, nunca dado real.
const CONTAS_DEMO: OcorrenciaDto['contas'] = [
  { nome: 'Banco Demo', tipo: 'banco', telefone: '(11) 4000-0001', link: 'https://example.com/banco-demo' },
  { nome: 'Operadora Demo', tipo: 'operadora', telefone: '*611', link: 'https://example.com/operadora-demo' },
];

export function fonteLocal(db: Banco): FonteOcorrencia {
  const repo = ocorrenciaRepo(db);
  return {
    async carregar(id) {
      const feitos = new Map((await repo.passos(id)).map((p) => [p.passo, p.concluidoEm]));
      // Item 12: a linha gravada pela demonstração é a mesma que o Histórico lista; só sem ela vale o padrão.
      const linha = await repo.obter(id);
      const estado = (linha?.estado ?? 'Aberta') as OcorrenciaDto['estado'];
      return {
        ocorrencia: {
          id,
          estado,
          origem: linha?.origem ?? 'chaveiro',
          iniciadaEm: linha?.iniciadaEm ?? new Date().toISOString(),
          // O banco local guarda só o horário do momento (sem coordenada); a tela mostra só o horário.
          momento: linha?.momentoEm ? { em: linha.momentoEm, lat: Number.NaN, lng: Number.NaN } : null,
          passos: ORDEM_PASSOS.map((passo) => ({ passo, concluidoEm: feitos.get(passo) ?? null })),
          alertas: [],
          contas: CONTAS_DEMO,
        },
      };
    },
    async concluirPasso(id, passo) {
      const concluidoEm = new Date().toISOString();
      await repo.marcarPasso(id, passo, concluidoEm);
      return { concluidoEm };
    },
  };
}

export function escolherFonte(id: string, db: Banco): FonteOcorrencia {
  return id.startsWith('demo-') ? fonteLocal(db) : fonteApi;
}
