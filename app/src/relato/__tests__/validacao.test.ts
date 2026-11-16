import { abrirBanco, type Banco } from '../../db/db';
import { relatoRepo, type RelatoPendente } from '../../db/repos';
import { enviarRelatos, podeEnviarRelato, validarRelato } from '../validacao';

let db: Banco;
let seq = 0;
beforeEach(async () => {
  (jest.requireMock('expo-sqlite') as { __reiniciar: () => void }).__reiniciar();
  db = await abrirBanco(`relato-${++seq}.db`);
});

// SINTETICO: coordenadas fixas de teste.
const AGORA = new Date('2026-11-14T15:00:00Z');
const antes = (min: number) => new Date(AGORA.getTime() - min * 60000).toISOString();
const pendente = (minAtras: number, texto: string | null = null): RelatoPendente => ({
  tipo: 'roubo', lat: -23.5672, lng: -46.7019, em: antes(minAtras), texto,
});

describe('validarRelato', () => {
  it('texto de 140 passa e de 141 falha com "Use até 140 caracteres."; só espaços equivale a vazio', () => {
    expect(validarRelato({ tipo: 'roubo', texto: 'a'.repeat(140) })).toEqual({ ok: true });
    expect(validarRelato({ tipo: 'roubo', texto: 'a'.repeat(141) })).toEqual({ ok: false, motivo: 'Use até 140 caracteres.' });
    expect(validarRelato({ tipo: 'furto', texto: `  ${'a'.repeat(140)}  ` })).toEqual({ ok: true });
    expect(validarRelato({ tipo: 'furto', texto: '     ' })).toEqual({ ok: true });
    expect(validarRelato({ tipo: 'furto' })).toEqual({ ok: true });
  });

  it('emoji e 10.000 caracteres colados não quebram a validação', () => {
    expect(validarRelato({ tipo: 'suspeita', texto: 'x'.repeat(10000) })).toEqual({ ok: false, motivo: 'Use até 140 caracteres.' });
    expect(validarRelato({ tipo: 'suspeita', texto: '😀'.repeat(10000) })).toEqual({ ok: false, motivo: 'Use até 140 caracteres.' });
    expect(validarRelato({ tipo: 'suspeita', texto: '😀 moto parada' })).toEqual({ ok: true });
  });

  it('rejeita tipo desconhecido e quebra de linha', () => {
    expect(validarRelato({ tipo: 'assalto' }).ok).toBe(false);
    expect(validarRelato({ tipo: '' }).ok).toBe(false);
    expect(validarRelato({ tipo: 'roubo', texto: 'linha 1\nlinha 2' })).toEqual({ ok: false, motivo: 'Escreva em uma linha só.' });
    expect(validarRelato({ tipo: 'roubo', texto: 'a\r\nb' }).ok).toBe(false);
  });
});

describe('podeEnviarRelato', () => {
  it('último há 1 min → false; há 3 min → true; nunca → true', () => {
    expect(podeEnviarRelato(new Date(AGORA.getTime() - 60_000), AGORA)).toBe(false);
    expect(podeEnviarRelato(new Date(AGORA.getTime() - 180_000), AGORA)).toBe(true);
    expect(podeEnviarRelato(new Date(AGORA.getTime() - 120_000), AGORA)).toBe(true);
    expect(podeEnviarRelato(null, AGORA)).toBe(true);
  });

  it('relógio que voltou (último no futuro) segue barrando; data inválida não trava', () => {
    expect(podeEnviarRelato(new Date(AGORA.getTime() + 60_000), AGORA)).toBe(false);
    expect(podeEnviarRelato(new Date('invalida'), AGORA)).toBe(true);
  });
});

describe('enviarRelatos', () => {
  it('descarta relato de 3 h e envia o de 30 min', async () => {
    const repo = relatoRepo(db);
    await repo.adicionar(pendente(180));
    await repo.adicionar(pendente(30, 'moto parada'));
    const enviar = jest.fn().mockResolvedValue(undefined);
    expect(await enviarRelatos(db, enviar, AGORA)).toEqual({ enviados: 1, descartados: 1 });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toMatchObject({ tipo: 'roubo', texto: 'moto parada', em: antes(30) });
    expect(await repo.listar()).toEqual([]);
  });

  it('falha mantém o pendente e para quando não há rede', async () => {
    const repo = relatoRepo(db);
    await repo.adicionar(pendente(10));
    await repo.adicionar(pendente(5));
    const enviar = jest.fn().mockRejectedValue(Object.assign(new Error('sem rede'), { status: 0 }));
    expect(await enviarRelatos(db, enviar, AGORA)).toEqual({ enviados: 0, descartados: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(await repo.listar()).toHaveLength(2);
  });

  it('um relato recusado pelo servidor não trava os seguintes', async () => {
    const repo = relatoRepo(db);
    await repo.adicionar(pendente(10, 'a'));
    await repo.adicionar(pendente(5, 'b'));
    const enviar = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { status: 422 }))
      .mockResolvedValueOnce(undefined);
    expect(await enviarRelatos(db, enviar, AGORA)).toEqual({ enviados: 1, descartados: 0 });
    expect((await repo.listar()).map((r) => r.texto)).toEqual(['a']);
  });

  it('relato sem posição é descartado, nunca enviado', async () => {
    await relatoRepo(db).adicionar({ ...pendente(5), lat: null, lng: null });
    const enviar = jest.fn();
    expect(await enviarRelatos(db, enviar, AGORA)).toEqual({ enviados: 0, descartados: 1 });
    expect(enviar).not.toHaveBeenCalled();
  });
});
