import type { Banco } from '../db/db';
import { sessaoRepo } from '../db/repos';

export type IdItemChecklist = 'protecaoRoubo' | 'limitePix' | 'senhasNaoSalvas';
export type ItemChecklist = { id: IdItemChecklist; titulo: string; comoFazer: string };

// Texto em linguagem simples e genérico: sem caminhos de menu de marca específica.
export const ITENS_CHECKLIST: ItemChecklist[] = [
  {
    id: 'protecaoRoubo',
    titulo: 'Ligar a proteção contra roubo do sistema do celular',
    comoFazer: 'Procure nas configurações de segurança do celular a opção de proteção contra roubo e ligue. Ela dificulta o uso do aparelho por quem o levar.',
  },
  {
    id: 'limitePix',
    titulo: 'Reduzir o limite do Pix à noite no app do banco',
    comoFazer: 'No app do seu banco, procure o limite do Pix e deixe o valor da noite baixo. Assim, um golpe tem menos o que levar.',
  },
  {
    id: 'senhasNaoSalvas',
    titulo: 'Não guardar senhas de banco no navegador ou nas notas',
    comoFazer: 'Apague senhas de banco salvas no navegador e nos blocos de notas do celular. Use um gerenciador de senhas ou decore.',
  },
];

const chave = (id: IdItemChecklist) => `checklist.${id}`;

export async function lerChecklist(db: Banco): Promise<Record<IdItemChecklist, boolean>> {
  const repo = sessaoRepo(db);
  const r = { protecaoRoubo: false, limitePix: false, senhasNaoSalvas: false };
  for (const i of ITENS_CHECKLIST) r[i.id] = (await repo.get(chave(i.id))) === '1';
  return r;
}

export async function marcarItem(db: Banco, id: IdItemChecklist, feito: boolean): Promise<void> {
  await sessaoRepo(db).set(chave(id), feito ? '1' : '0');
}
