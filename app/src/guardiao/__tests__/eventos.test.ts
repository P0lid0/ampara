import { abrirBanco, type Banco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { gerarEventoDemo, handleEvent, rotuloEstado, useAvisoChaveiro, type EventoChaveiro } from '../eventos';
import { useAlarmes } from '../store';

// SINTETICO: deviceId de demonstração.
const ID = 'chaveiro-ampara-0de300';
const AGORA = new Date('2026-11-16T14:00:00Z');
const agora = () => AGORA;

let db: Banco;

beforeEach(async () => {
  db = await abrirBanco();
  await sessaoRepo(db).apagarTudo();
  useAlarmes.getState().limpar();
  useAvisoChaveiro.getState().limpar();
});

const contar = async (tabela: string) => (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela}`))?.n ?? 0;

describe('gerarEventoDemo', () => {
  it('eventId = `${deviceId}-demo-${n}` e, no alert, alertId igual ao eventId (contrato do Vitor)', () => {
    const e = gerarEventoDemo('alert', ID, 7);
    expect(e).toMatchObject({ eventId: `${ID}-demo-7`, type: 'alert', deviceId: ID, alertId: `${ID}-demo-7`, ts: null });
  });

  it('low_battery leva a bateria em %', () => {
    expect(typeof gerarEventoDemo('low_battery', ID, 1).battery).toBe('number');
  });

  it('sem n, eventos gerados em sequência nunca repetem o eventId (ficam gravados no SQLite)', () => {
    const ids = new Set(Array.from({ length: 50 }, () => gerarEventoDemo('alert', ID).eventId));
    expect(ids.size).toBe(50);
  });
});

describe('handleEvent', () => {
  it('mesmo eventId 5x: retorna ["nova","repetida"×4], ackLocal chamado 5x, 1 linha em ocorrencia e 1 em evento_recebido', async () => {
    const ackLocal = jest.fn();
    const e = gerarEventoDemo('alert', ID, 1);
    const r: string[] = [];
    for (let i = 0; i < 5; i++) r.push(await handleEvent(e, { db, ackLocal, agora }));
    expect(r).toEqual(['nova', 'repetida', 'repetida', 'repetida', 'repetida']);
    expect(ackLocal).toHaveBeenCalledTimes(5);
    expect(ackLocal).toHaveBeenCalledWith(e.eventId);
    expect(await contar('ocorrencia')).toBe(1);
    expect(await contar('evento_recebido')).toBe(1);
  });

  it('alert grava a ocorrência demo-<alertId> "Aberta" com Pessoa Demo e a hora de agora - ageMs', async () => {
    const e: EventoChaveiro = { ...gerarEventoDemo('alert', ID, 2), ageMs: 60_000 };
    await handleEvent(e, { db, ackLocal: jest.fn(), agora });
    const o = await ocorrenciaRepo(db).obter(`demo-${e.alertId}`);
    expect(o).toMatchObject({ estado: 'Aberta', origem: 'chaveiro', vitimaNome: 'Pessoa Demo', iniciadaEm: '2026-11-16T13:59:00.000Z' });
  });

  it('ts em segundos Unix vira a hora do clique', async () => {
    const e: EventoChaveiro = { ...gerarEventoDemo('alert', ID, 3), ts: 1763089200 };
    await handleEvent(e, { db, ackLocal: jest.fn(), agora });
    expect((await ocorrenciaRepo(db).obter(`demo-${e.alertId}`))?.iniciadaEm).toBe(new Date(1763089200 * 1000).toISOString());
  });

  it('alert abre alarme na store (1 ativo); o 2º igual não reabre', async () => {
    const e = gerarEventoDemo('alert', ID, 4);
    await handleEvent(e, { db, ackLocal: jest.fn(), agora });
    const ativos = Object.values(useAlarmes.getState().estado.ativos);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]).toMatchObject({ alertaId: e.alertId, ocorrenciaId: `demo-${e.alertId}`, vitimaNome: 'Pessoa Demo' });
    const aplicar = jest.spyOn(useAlarmes.getState(), 'aplicar');
    expect(await handleEvent(e, { db, ackLocal: jest.fn(), agora })).toBe('repetida');
    expect(aplicar).not.toHaveBeenCalled();
    expect(Object.keys(useAlarmes.getState().estado.ativos)).toHaveLength(1);
    aplicar.mockRestore();
  });

  it('cancel depois de alert: estado "Cancelada" e alerta encerrado com motivo cancelado', async () => {
    const alerta = gerarEventoDemo('alert', ID, 5);
    await handleEvent(alerta, { db, ackLocal: jest.fn(), agora });
    const cancel: EventoChaveiro = { ...gerarEventoDemo('cancel', ID, 6), alertId: alerta.alertId };
    expect(await handleEvent(cancel, { db, ackLocal: jest.fn(), agora })).toBe('nova');
    expect((await ocorrenciaRepo(db).obter(`demo-${alerta.alertId}`))?.estado).toBe('Cancelada');
    const { estado } = useAlarmes.getState();
    expect(estado.ativos).toEqual({});
    expect(estado.motivos[alerta.alertId]).toBe('cancelado');
  });

  it('test não cria alarme e grava ocorrência "Teste"; low_battery não cria ocorrência', async () => {
    const teste = gerarEventoDemo('test', ID, 7);
    await handleEvent(teste, { db, ackLocal: jest.fn(), agora });
    expect(useAlarmes.getState().estado.ativos).toEqual({});
    const lista = await ocorrenciaRepo(db).listar();
    expect(lista).toHaveLength(1);
    expect(lista[0].estado).toBe('Teste');
    expect(useAvisoChaveiro.getState().mensagem).toBe('Chaveiro funcionando');

    const bateria: EventoChaveiro = { ...gerarEventoDemo('low_battery', ID, 8), battery: 12 };
    expect(await handleEvent(bateria, { db, ackLocal: jest.fn(), agora })).toBe('nova');
    expect(await ocorrenciaRepo(db).listar()).toHaveLength(1);
    expect(useAlarmes.getState().estado.ativos).toEqual({});
    expect(useAvisoChaveiro.getState().mensagem).toBe('Bateria do chaveiro em 12%. Carregue para continuar protegido.');
  });

  it('test sem alertId grava a ocorrência pelo eventId', async () => {
    const e: EventoChaveiro = { ...gerarEventoDemo('test', ID, 11), alertId: '' };
    await handleEvent(e, { db, ackLocal: jest.fn(), agora });
    expect((await ocorrenciaRepo(db).obter(`demo-${e.eventId}`))?.estado).toBe('Teste');
  });

  it('impact é tratado como alert, com origem impacto', async () => {
    const e = gerarEventoDemo('impact', ID, 9);
    await handleEvent(e, { db, ackLocal: jest.fn(), agora });
    expect((await ocorrenciaRepo(db).obter(`demo-${e.alertId}`))?.origem).toBe('impacto');
    expect(useAlarmes.getState().estado.ativos[e.alertId]?.origem).toBe('impacto');
  });

  it('sem eventId duplicado em memória: reabrir o banco (nova instância) e reenviar o evento devolve "repetida"', async () => {
    const e = gerarEventoDemo('alert', ID, 10);
    expect(await handleEvent(e, { db, ackLocal: jest.fn(), agora })).toBe('nova');
    useAlarmes.getState().limpar();
    const outro = await abrirBanco();
    expect(outro).not.toBe(db);
    const ackLocal = jest.fn();
    expect(await handleEvent(e, { db: outro, ackLocal, agora })).toBe('repetida');
    expect(ackLocal).toHaveBeenCalledTimes(1);
    expect(useAlarmes.getState().estado.ativos).toEqual({});
  });
});

describe('rotuloEstado', () => {
  it('rotuloEstado("Aberta")→"Aberta"; "Cancelada"→"Cancelada"; "Encerrada"→"Encerrada"; "valorNovo"→"valorNovo"', () => {
    expect(rotuloEstado('Aberta')).toBe('Aberta');
    expect(rotuloEstado('Cancelada')).toBe('Cancelada');
    expect(rotuloEstado('Encerrada')).toBe('Encerrada');
    expect(rotuloEstado('Teste')).toBe('Teste');
    expect(rotuloEstado('valorNovo')).toBe('valorNovo');
  });
});
