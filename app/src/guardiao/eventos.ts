// Eventos do chaveiro (contrato do Vitor, iot/docs/contrato-mqtt.md) tratados no próprio aparelho.
// `handleEvent` é o único ponto de entrada do modo demonstração: confirma (ack) toda vez que o evento
// chega e só age na primeira, com a idempotência guardada no SQLite (evento_recebido), nunca em memória.
// Tudo é local: funciona sem internet e sem servidor.
import { create } from 'zustand';

import type { Banco } from '../db/db';
import { eventoRepo, ocorrenciaRepo } from '../db/repos';
import type { Efeito, EventoHub } from './alarmeEstado';
import { cancelarAlarme, exibirAlarme } from './notificacao';
import { useAlarmes } from './store';

export type EventoChaveiro = {
  eventId: string;
  type: 'alert' | 'cancel' | 'test' | 'low_battery' | 'impact';
  deviceId: string;
  /** Em `alert`, igual ao `eventId`; em `cancel`, o alerta cancelado. */
  alertId: string;
  /** Hora do clique em segundos Unix (UTC); `null` => agora - ageMs. */
  ts: number | null;
  ageMs?: number;
  attempt?: number;
  battery?: number;
  fw?: string;
};

export type DepsEvento = { db: Banco; ackLocal: (eventId: string) => void; agora?: () => Date };

/** Prefixo das ocorrências locais da demonstração (o passo a passo usa a fonte local para elas). */
export const PREFIXO_DEMO = 'demo-';
// SINTETICO: nome da vítima na demonstração, nunca dado real.
export const VITIMA_DEMO = 'Pessoa Demo';
export const MSG_TESTE = 'Chaveiro funcionando';

export const mensagemBateria = (n?: number) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `Bateria do chaveiro em ${Math.round(n)}%. Carregue para continuar protegido.`
    : 'Bateria do chaveiro baixa. Carregue para continuar protegido.';

/** Último aviso do chaveiro para a tela ("Chaveiro funcionando", bateria baixa). Só memória. */
type AvisoChaveiro = { mensagem: string | null; definir(m: string): void; limpar(): void };
export const useAvisoChaveiro = create<AvisoChaveiro>()((set) => ({
  mensagem: null,
  definir: (mensagem) => set({ mensagem }),
  limpar: () => set({ mensagem: null }),
}));

const ROTULOS: Record<string, string> = {
  Aberta: 'Aberta',
  Cancelada: 'Cancelada',
  Encerrada: 'Encerrada',
  Teste: 'Teste',
};

/** Estado da ocorrência em texto para a tela; valor desconhecido aparece como veio. */
export function rotuloEstado(estado: string): string {
  return ROTULOS[estado] ?? estado;
}

let ultimoN = 0;
// Relógio que nunca repete: dois eventos gerados no mesmo milissegundo ganham números diferentes.
const proximoN = () => {
  ultimoN = Math.max(Date.now(), ultimoN + 1);
  return ultimoN;
};

/**
 * Evento sintético da demonstração. `eventId` = `${deviceId}-demo-${n}` e `alertId` = `eventId` (como no
 * `alert` do firmware); num `cancel`, quem chama troca o `alertId` pelo do alerta a cancelar.
 * Sem `n`, usa o relógio: os `eventId` ficam gravados no SQLite e não podem se repetir entre aberturas do app.
 */
export function gerarEventoDemo(tipo: EventoChaveiro['type'], deviceId: string, n: number = proximoN()): EventoChaveiro {
  const eventId = `${deviceId}-demo-${n}`;
  // SINTETICO: bateria e firmware de demonstração.
  return { eventId, type: tipo, deviceId, alertId: eventId, ts: null, ageMs: 0, attempt: 1, battery: tipo === 'low_battery' ? 12 : 80, fw: '1.0.0' };
}

/** Hora do clique: `ts` (segundos Unix) ou agora - ageMs. */
function horaDoClique(e: EventoChaveiro, agora: Date): string {
  if (typeof e.ts === 'number' && Number.isFinite(e.ts)) return new Date(e.ts * 1000).toISOString();
  const atraso = typeof e.ageMs === 'number' && Number.isFinite(e.ageMs) && e.ageMs > 0 ? e.ageMs : 0;
  return new Date(agora.getTime() - atraso).toISOString();
}

// O alarme da demonstração passa pelo mesmo store e pelas mesmas notificações do alarme real.
async function aplicarNoAlarme(ev: EventoHub): Promise<void> {
  const efeitos: Efeito[] = useAlarmes.getState().aplicar(ev);
  for (const ef of efeitos) {
    try {
      if (ef.tipo === 'tocar') await exibirAlarme(ef.alerta);
      else if (ef.tipo === 'parar') await cancelarAlarme(ef.alertaId);
    } catch {
      console.warn(`demonstracao: efeito ${ef.tipo} falhou`);
    }
  }
}

/** Confirma (`ackLocal`) toda vez; age só na primeira vez que o `eventId` chega. */
export async function handleEvent(e: EventoChaveiro, d: DepsEvento): Promise<'nova' | 'repetida'> {
  const agora = (d.agora ?? (() => new Date()))();
  const nova = await eventoRepo(d.db).registrar(e.eventId, agora.getTime());
  d.ackLocal(e.eventId);
  if (!nova) return 'repetida';

  const repo = ocorrenciaRepo(d.db);
  // Sem alertId (ex.: `test` do firmware), a ocorrência usa o próprio eventId.
  const alertaId = e.alertId || e.eventId;
  const id = PREFIXO_DEMO + alertaId;
  const agoraIso = agora.toISOString();

  switch (e.type) {
    case 'alert':
    case 'impact': {
      const origem = e.type === 'impact' ? 'impacto' : 'chaveiro';
      const em = horaDoClique(e, agora);
      await repo.upsert({ id, estado: 'Aberta', origem, iniciadaEm: em, momentoEm: null, vitimaNome: VITIMA_DEMO, atualizadoEm: agoraIso });
      await aplicarNoAlarme({
        tipo: 'AlertaDisparado',
        dado: { alertaId, ocorrenciaId: id, vitimaNome: VITIMA_DEMO, origem, em },
      });
      break;
    }
    case 'cancel': {
      const atual = await repo.obter(id);
      if (atual) await repo.upsert({ ...atual, estado: 'Cancelada', atualizadoEm: agoraIso });
      await aplicarNoAlarme({ tipo: 'AlertaEncerrado', dado: { alertaId, motivo: 'cancelado' } });
      break;
    }
    case 'test': {
      await repo.upsert({
        id,
        estado: 'Teste',
        origem: 'chaveiro',
        iniciadaEm: horaDoClique(e, agora),
        momentoEm: null,
        vitimaNome: null,
        atualizadoEm: agoraIso,
      });
      useAvisoChaveiro.getState().definir(MSG_TESTE);
      break;
    }
    case 'low_battery':
      useAvisoChaveiro.getState().definir(mensagemBateria(e.battery));
      break;
    default:
      break;
  }
  return 'nova';
}
