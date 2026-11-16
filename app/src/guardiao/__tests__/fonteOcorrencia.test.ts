import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { emitirPasso, ouvirPassos } from '../passosAoVivo';
import { escolherFonte, fonteApi, fonteLocal, ORDEM_PASSOS, urlTelefone } from '../fonteOcorrencia';

jest.setTimeout(60000);

jest.mock('../../api/endpoints', () => ({
  api: { ocorrencias: { obter: jest.fn(), concluirPasso: jest.fn() }, contas: { catalogo: jest.fn() } },
}));

const obter = jest.mocked(api.ocorrencias.obter);
const concluir = jest.mocked(api.ocorrencias.concluirPasso);

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo();
  obter.mockReset();
  concluir.mockReset().mockResolvedValue(undefined);
});

describe('urlTelefone', () => {
  it('item 18: telefone nulo, vazio ou sem dígitos (catálogo real) devolve null em vez de quebrar', () => {
    expect(urlTelefone(null)).toBeNull();
    expect(urlTelefone(undefined)).toBeNull();
    expect(urlTelefone('   ')).toBeNull();
    expect(urlTelefone('ligue já')).toBeNull();
  });

  it('urlTelefone("(11) 4004-0000") === "tel:1140040000"; mantém o + inicial', () => {
    expect(urlTelefone('(11) 4004-0000')).toBe('tel:1140040000');
    expect(urlTelefone('+55 (11) 4004-0000')).toBe('tel:+551140040000');
    expect(urlTelefone('0800 123 4567')).toBe('tel:08001234567');
  });
  it('não deixa passar nada além de dígitos e do + inicial', () => {
    expect(urlTelefone('11+4004;0000')).toBe('tel:1140040000');
    expect(urlTelefone('tel:123 && rm')).toBe('tel:123');
  });
  it('preserva códigos curtos: *611 não vira 611, # vai como %23', () => {
    expect(urlTelefone('*611')).toBe('tel:*611');
    expect(urlTelefone('*#06#')).toBe('tel:*%2306%23');
    expect(urlTelefone('+*611')).toBe('tel:+*611');
  });
});

it('ORDEM_PASSOS segue Banco, CelularSeguro, Operadora, Senhas, Bo', () => {
  expect(ORDEM_PASSOS).toEqual(['Banco', 'CelularSeguro', 'Operadora', 'Senhas', 'Bo']);
});

describe('escolherFonte', () => {
  it('"demo-" usa a fonte local; o resto usa a API', async () => {
    const db = await abrirBanco();
    expect(escolherFonte('demo-1', db)).not.toBe(fonteApi);
    expect(escolherFonte('oc-1', db)).toBe(fonteApi);
  });
});

describe('fonteApi', () => {
  it('carregar devolve a ocorrência da API e concluirPasso chama a API e devolve o horário (ISO com Z)', async () => {
    const oc = { id: 'oc-1' } as never;
    obter.mockResolvedValue(oc);
    expect((await fonteApi.carregar('oc-1')).ocorrencia).toBe(oc);
    const r = await fonteApi.concluirPasso('oc-1', 'Banco');
    expect(concluir).toHaveBeenCalledWith('oc-1', 'Banco');
    expect(r.concluidoEm).toMatch(/Z$/);
  });
  it('falha da API propaga e não devolve horário', async () => {
    concluir.mockRejectedValue(new Error('x'));
    await expect(fonteApi.concluirPasso('oc-1', 'Banco')).rejects.toThrow();
  });
});

describe('fonteLocal', () => {
  it('devolve a ocorrência demo com 5 passos pendentes e contas sintéticas, sem chamar a API', async () => {
    const f = fonteLocal(await abrirBanco());
    const { ocorrencia } = await f.carregar('demo-1');
    expect(ocorrencia.id).toBe('demo-1');
    expect(ocorrencia.passos.map((p) => p.passo)).toEqual(ORDEM_PASSOS);
    expect(ocorrencia.passos.every((p) => p.concluidoEm === null)).toBe(true);
    expect(ocorrencia.contas.some((c) => c.tipo === 'banco')).toBe(true);
    expect(ocorrencia.contas.some((c) => c.tipo === 'operadora')).toBe(true);
    expect(obter).not.toHaveBeenCalled();
    expect(api.contas.catalogo).not.toHaveBeenCalled();
  });
  it('concluirPasso grava na tabela passo e o próximo carregar traz o horário', async () => {
    const db = await abrirBanco();
    const f = fonteLocal(db);
    const { concluidoEm } = await f.concluirPasso('demo-1', 'Senhas');
    expect(concluidoEm).toMatch(/Z$/);
    expect(await ocorrenciaRepo(db).passos('demo-1')).toEqual([{ passo: 'Senhas', concluidoEm }]);
    const { ocorrencia } = await f.carregar('demo-1');
    expect(ocorrencia.passos.find((p) => p.passo === 'Senhas')?.concluidoEm).toBe(concluidoEm);
    expect(concluir).not.toHaveBeenCalled();
  });
});

describe('passosAoVivo', () => {
  it('entrega o evento a quem ouve e para depois de cancelar', () => {
    const visto: unknown[] = [];
    const parar = ouvirPassos((e) => visto.push(e));
    emitirPasso({ ocorrenciaId: 'o', passo: 'Banco', concluidoEm: 't' });
    parar();
    emitirPasso({ ocorrenciaId: 'o', passo: 'Senhas', concluidoEm: 't' });
    expect(visto).toEqual([{ ocorrenciaId: 'o', passo: 'Banco', concluidoEm: 't' }]);
  });
});
