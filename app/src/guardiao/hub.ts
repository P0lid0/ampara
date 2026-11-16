// Conexão SignalR do guardião com o hub /hubs/guardiao (JWT do guardião).
// Servidor → cliente: AlertaDisparado, AlertaEscalado, AlertaEncerrado, PassoAtualizado.
// Cliente → servidor: nada (as ações vão pela API REST).
import { HubConnectionBuilder } from '@microsoft/signalr';

import type { EventoHub } from './alarmeEstado';

export type HubLike = {
  on(nome: string, cb: (d: any) => void): void;
  onreconnecting(cb: () => void): void;
  onreconnected(cb: () => void): void;
  onclose(cb: () => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type EstadoHub = 'conectado' | 'reconectando' | 'desconectado';

export type OpcoesHub = {
  baseUrl: string;
  obterToken: () => string;
  aoEvento: (ev: EventoHub) => void;
  aoEstado: (s: EstadoHub) => void;
  aoReconectar: () => void;
  construir?: (url: string, tokenFactory: () => string) => HubLike;
};

export const EVENTOS_HUB = ['AlertaDisparado', 'AlertaEscalado', 'AlertaEncerrado', 'PassoAtualizado'] as const;

export const ESPERAS_RECONEXAO_MS = [0, 2000, 5000, 10000, 30000];

const construirPadrao = (url: string, tokenFactory: () => string): HubLike =>
  new HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory: tokenFactory })
    .withAutomaticReconnect(ESPERAS_RECONEXAO_MS)
    .build();

export function criarHub(o: OpcoesHub): { iniciar(): Promise<void>; parar(): Promise<void> } {
  const construir = o.construir ?? construirPadrao;
  const url = `${o.baseUrl.replace(/\/+$/, '')}/hubs/guardiao`;
  let conexao: HubLike | null = null;
  let ultimoEstado: EstadoHub | null = null;

  const anunciar = (s: EstadoHub) => {
    if (s === ultimoEstado) return;
    ultimoEstado = s;
    o.aoEstado(s);
  };

  return {
    async iniciar() {
      if (conexao) return;
      const c = construir(url, () => o.obterToken());
      conexao = c;
      for (const nome of EVENTOS_HUB) {
        c.on(nome, (d: unknown) => {
          if (conexao !== c) return;
          if (d === null || typeof d !== 'object') return;
          o.aoEvento({ tipo: nome, dado: d } as EventoHub);
        });
      }
      c.onreconnecting(() => {
        if (conexao === c) anunciar('reconectando');
      });
      c.onreconnected(() => {
        if (conexao !== c) return;
        anunciar('conectado');
        o.aoReconectar();
      });
      c.onclose(() => {
        if (conexao !== c) return;
        // A reconexão automática desistiu: a próxima chamada de iniciar() abre uma conexão nova.
        conexao = null;
        anunciar('desconectado');
      });
      try {
        await c.start();
      } catch (erro) {
        if (conexao === c) conexao = null;
        anunciar('desconectado');
        throw erro;
      }
      if (conexao === c) anunciar('conectado');
    },

    async parar() {
      const c = conexao;
      if (!c) return;
      conexao = null;
      try {
        await c.stop();
      } finally {
        anunciar('desconectado');
      }
    },
  };
}
