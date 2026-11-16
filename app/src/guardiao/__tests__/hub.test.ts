import type { EventoHub } from '../alarmeEstado';
import { criarHub, type HubLike } from '../hub';

jest.mock('@microsoft/signalr', () => {
  const conexao = {
    on: jest.fn(),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
    onclose: jest.fn(),
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
  };
  const builder: Record<string, jest.Mock> = {};
  builder.withUrl = jest.fn(() => builder);
  builder.withAutomaticReconnect = jest.fn(() => builder);
  builder.build = jest.fn(() => conexao);
  return { __esModule: true, __builder: builder, __conexao: conexao, HubConnectionBuilder: jest.fn(() => builder) };
});

type HubFalso = HubLike & {
  handlers: Record<string, (d: unknown) => void>;
  reconectando?: () => void;
  reconectado?: () => void;
  fechado?: () => void;
  start: jest.Mock;
  stop: jest.Mock;
};

const hubFalso = (): HubFalso => {
  const h: HubFalso = {
    handlers: {},
    on(nome, cb) {
      h.handlers[nome] = cb;
    },
    onreconnecting(cb) {
      h.reconectando = cb;
    },
    onreconnected(cb) {
      h.reconectado = cb;
    },
    onclose(cb) {
      h.fechado = cb;
    },
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => {
      h.fechado?.();
    }),
  };
  return h;
};

const montar = (baseUrl = 'http://10.0.2.2:5080') => {
  const falso = hubFalso();
  const aoEvento = jest.fn<void, [EventoHub]>();
  const aoEstado = jest.fn<void, ['conectado' | 'reconectando' | 'desconectado']>();
  const aoReconectar = jest.fn();
  const construir = jest.fn((_url: string, _token: () => string) => falso);
  const obterToken = jest.fn(() => 'token-de-teste');
  const hub = criarHub({ baseUrl, obterToken, aoEvento, aoEstado, aoReconectar, construir });
  return { hub, falso, aoEvento, aoEstado, aoReconectar, construir, obterToken };
};

describe('criarHub', () => {
  it('iniciar assina AlertaDisparado, AlertaEscalado, AlertaEncerrado e PassoAtualizado e repassa aoEvento com {tipo, dado}', async () => {
    const { hub, falso, aoEvento, aoEstado, construir, obterToken } = montar();
    await hub.iniciar();

    expect(construir).toHaveBeenCalledTimes(1);
    expect(construir.mock.calls[0][0]).toBe('http://10.0.2.2:5080/hubs/guardiao');
    expect(construir.mock.calls[0][1]()).toBe('token-de-teste');
    expect(obterToken).toHaveBeenCalled();
    expect(falso.start).toHaveBeenCalledTimes(1);
    expect(Object.keys(falso.handlers).sort()).toEqual(['AlertaDisparado', 'AlertaEncerrado', 'AlertaEscalado', 'PassoAtualizado']);
    expect(aoEstado).toHaveBeenLastCalledWith('conectado');

    // SINTETICO
    const dDisparado = { alertaId: 'a1', ocorrenciaId: 'oc-1', vitimaNome: 'Pessoa Demo', origem: 'chaveiro', em: '2026-11-15T12:00:00Z' };
    const dEscalado = { alertaId: 'a1', ocorrenciaId: 'oc-1', paraGuardiaoId: 'g-2', em: '2026-11-15T12:05:00Z' };
    const dEncerrado = { alertaId: 'a1', motivo: 'ciente' };
    const dPasso = { ocorrenciaId: 'oc-1', passo: 'banco', concluidoEm: '2026-11-15T12:10:00Z' };
    falso.handlers.AlertaDisparado(dDisparado);
    falso.handlers.AlertaEscalado(dEscalado);
    falso.handlers.AlertaEncerrado(dEncerrado);
    falso.handlers.PassoAtualizado(dPasso);

    expect(aoEvento.mock.calls.map((c) => c[0])).toEqual([
      { tipo: 'AlertaDisparado', dado: dDisparado },
      { tipo: 'AlertaEscalado', dado: dEscalado },
      { tipo: 'AlertaEncerrado', dado: dEncerrado },
      { tipo: 'PassoAtualizado', dado: dPasso },
    ]);
  });

  it('carga vazia ou que não é objeto é descartada sem chamar aoEvento', async () => {
    const { hub, falso, aoEvento } = montar();
    await hub.iniciar();
    falso.handlers.AlertaDisparado(null);
    falso.handlers.AlertaEncerrado('texto');
    expect(aoEvento).not.toHaveBeenCalled();
  });

  it('baseUrl com barra no fim não gera barra dupla', async () => {
    const { hub, construir } = montar('http://10.0.2.2:5080/');
    await hub.iniciar();
    expect(construir.mock.calls[0][0]).toBe('http://10.0.2.2:5080/hubs/guardiao');
  });

  it('onreconnecting → aoEstado("reconectando"); onreconnected → aoEstado("conectado") e aoReconectar chamado 1 vez', async () => {
    const { hub, falso, aoEstado, aoReconectar } = montar();
    await hub.iniciar();
    aoEstado.mockClear();

    falso.reconectando!();
    expect(aoEstado).toHaveBeenLastCalledWith('reconectando');
    expect(aoReconectar).not.toHaveBeenCalled();

    falso.reconectado!();
    expect(aoEstado).toHaveBeenLastCalledWith('conectado');
    expect(aoReconectar).toHaveBeenCalledTimes(1);
  });

  it('onclose (reconexão automática desistiu) → aoEstado("desconectado")', async () => {
    const { hub, falso, aoEstado } = montar();
    await hub.iniciar();
    falso.fechado!();
    expect(aoEstado).toHaveBeenLastCalledWith('desconectado');
  });

  it('parar chama stop e aoEstado("desconectado")', async () => {
    const { hub, falso, aoEstado } = montar();
    await hub.iniciar();
    aoEstado.mockClear();
    await hub.parar();
    expect(falso.stop).toHaveBeenCalledTimes(1);
    expect(aoEstado).toHaveBeenCalledWith('desconectado');
    // stop dispara onclose também: o estado não é anunciado duas vezes
    expect(aoEstado).toHaveBeenCalledTimes(1);
  });

  it('iniciar duas vezes não abre segunda conexão; depois de parar, iniciar abre de novo', async () => {
    const { hub, construir, falso } = montar();
    await hub.iniciar();
    await hub.iniciar();
    expect(construir).toHaveBeenCalledTimes(1);
    expect(falso.start).toHaveBeenCalledTimes(1);
    await hub.parar();
    await hub.iniciar();
    expect(construir).toHaveBeenCalledTimes(2);
  });

  it('parar sem ter iniciado não quebra', async () => {
    const { hub, aoEstado } = montar();
    await expect(hub.parar()).resolves.toBeUndefined();
    expect(aoEstado).not.toHaveBeenCalledWith('conectado');
  });

  it('start que falha anuncia "desconectado", repassa o erro e permite tentar de novo', async () => {
    const { hub, falso, aoEstado, construir } = montar();
    falso.start.mockRejectedValueOnce(new Error('sem rede'));
    await expect(hub.iniciar()).rejects.toThrow('sem rede');
    expect(aoEstado).toHaveBeenLastCalledWith('desconectado');
    await hub.iniciar();
    expect(construir).toHaveBeenCalledTimes(2);
    expect(aoEstado).toHaveBeenLastCalledWith('conectado');
  });

  it('sem construir, usa HubConnectionBuilder com /hubs/guardiao, accessTokenFactory e reconexão [0, 2000, 5000, 10000, 30000]', async () => {
    const signalr = jest.requireMock('@microsoft/signalr') as {
      __builder: { withUrl: jest.Mock; withAutomaticReconnect: jest.Mock; build: jest.Mock };
      __conexao: { start: jest.Mock };
    };
    const hub = criarHub({
      baseUrl: 'http://10.0.2.2:5080',
      obterToken: () => 'token-de-teste',
      aoEvento: jest.fn(),
      aoEstado: jest.fn(),
      aoReconectar: jest.fn(),
    });
    await hub.iniciar();
    const [url, opcoes] = signalr.__builder.withUrl.mock.calls[0];
    expect(url).toBe('http://10.0.2.2:5080/hubs/guardiao');
    expect(opcoes.accessTokenFactory()).toBe('token-de-teste');
    expect(signalr.__builder.withAutomaticReconnect).toHaveBeenCalledWith([0, 2000, 5000, 10000, 30000]);
    expect(signalr.__conexao.start).toHaveBeenCalledTimes(1);
  });
});
