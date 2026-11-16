import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';
import { ITENS_CHECKLIST, lerChecklist, marcarItem } from '../checklist';
import { rotuloBoStatus, rotuloRecuperacao, rotuloRetorno, TEXTO_ORIENTACAO, validarBoNumero } from '../retorno';

jest.setTimeout(60000);

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
});

describe('checklist de prevenção', () => {
  it('3 itens; marcarItem persiste e lerChecklist devolve {protecaoRoubo:true,...} após reabrir o banco', async () => {
    expect(ITENS_CHECKLIST.map((i) => i.id)).toEqual(['protecaoRoubo', 'limitePix', 'senhasNaoSalvas']);
    for (const i of ITENS_CHECKLIST) {
      expect(i.titulo.length).toBeGreaterThan(5);
      expect(i.comoFazer.length).toBeGreaterThan(5);
    }
    const db = await abrirBanco();
    expect(await lerChecklist(db)).toEqual({ protecaoRoubo: false, limitePix: false, senhasNaoSalvas: false });
    await marcarItem(db, 'protecaoRoubo', true);
    const reaberto = await abrirBanco();
    expect(await lerChecklist(reaberto)).toEqual({ protecaoRoubo: true, limitePix: false, senhasNaoSalvas: false });
    await marcarItem(reaberto, 'protecaoRoubo', false);
    expect((await lerChecklist(reaberto)).protecaoRoubo).toBe(false);
    expect(await sessaoRepo(reaberto).get('checklist.protecaoRoubo')).toBe('0');
  });
});

describe('retorno da polícia', () => {
  it('rotuloRetorno cobre os 4 status do contrato da Ponte e devolve o original para um status novo', () => {
    expect(rotuloRetorno('recebida')).toBe('Recebida pela polícia');
    expect(rotuloRetorno('em_analise')).toBe('Em análise');
    expect(rotuloRetorno('atendida')).toBe('Atendida');
    expect(rotuloRetorno('descartada')).toBe('Arquivada pela polícia');
    expect(rotuloRetorno('status_novo')).toBe('status_novo');
  });

  it('texto de orientação não promete o que a fonte não sustenta', () => {
    expect(TEXTO_ORIENTACAO).toBe('Para acompanhar sua ocorrência, guarde o protocolo e pergunte à delegacia.');
  });
});

describe('acompanhamento', () => {
  it('rótulos de status do BO e da recuperação', () => {
    expect(rotuloBoStatus('nao_registrado')).toBe('BO ainda não registrado');
    expect(rotuloBoStatus('registrado')).toBe('BO registrado');
    expect(rotuloRecuperacao('sem_noticia')).toBe('Sem notícias do celular');
    expect(rotuloRecuperacao('localizado')).toBe('Celular localizado');
    expect(rotuloRecuperacao('recuperado')).toBe('Celular recuperado');
  });

  it('validarBoNumero: vazio ok; 1 a 30 alfanuméricos, / e -; recusa espaço e 31+', () => {
    expect(validarBoNumero('')).toBe(true);
    expect(validarBoNumero('ABC123/2026-1')).toBe(true);
    expect(validarBoNumero('A'.repeat(30))).toBe(true);
    expect(validarBoNumero('A'.repeat(31))).toBe(false);
    expect(validarBoNumero('AB 12')).toBe(false);
    expect(validarBoNumero(' AB12')).toBe(false);
    expect(validarBoNumero('AB#12')).toBe(false);
  });
});
