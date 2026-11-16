// Estado dos alarmes do guardião: reducer puro sobre os eventos do hub /hubs/guardiao.
// Regras (RF3): o mesmo alertaId toca uma vez só (replay da reconexão, escalada);
// AlertaEncerrado para a sirene; um alerta encerrado nunca volta a tocar.

export type MotivoEncerramento = 'ciente' | 'cancelado' | 'encerrado';

export type AlertaAtivo = {
  alertaId: string;
  ocorrenciaId: string;
  vitimaNome: string;
  origem: string;
  em: string;
  cienteEnviado: boolean;
};

export type EstadoAlarmes = {
  ativos: Record<string, AlertaAtivo>;
  // Últimos MAX_ENCERRADOS alertaId encerrados, do mais antigo ao mais recente.
  encerrados: string[];
  // Motivo de cada alertaId em `encerrados`, para a tela dizer por que o alarme parou.
  motivos: Record<string, MotivoEncerramento>;
};

export type EventoHub =
  | { tipo: 'AlertaDisparado'; dado: { alertaId: string; ocorrenciaId: string; vitimaNome: string; origem: string; em: string } }
  | { tipo: 'AlertaEscalado'; dado: { alertaId: string; ocorrenciaId: string; paraGuardiaoId: string; em: string } }
  | { tipo: 'AlertaEncerrado'; dado: { alertaId: string; motivo: MotivoEncerramento } }
  | { tipo: 'PassoAtualizado'; dado: { ocorrenciaId: string; passo: string; concluidoEm: string } };

export type Efeito =
  | { tipo: 'tocar'; alerta: AlertaAtivo }
  | { tipo: 'parar'; alertaId: string; motivo: MotivoEncerramento }
  | { tipo: 'buscarAtivos' }
  | { tipo: 'passo'; ocorrenciaId: string; passo: string; concluidoEm: string };

export const MAX_ENCERRADOS = 200;

export const estadoInicial = (): EstadoAlarmes => ({ ativos: {}, encerrados: [], motivos: {} });

const conhecido = (e: EstadoAlarmes, alertaId: string) => alertaId in e.ativos || e.encerrados.includes(alertaId);

const encerrar = (e: EstadoAlarmes, alertaId: string, motivo: MotivoEncerramento): EstadoAlarmes => {
  const { [alertaId]: _removido, ...ativos } = e.ativos;
  const encerrados = e.encerrados.includes(alertaId) ? e.encerrados : [...e.encerrados, alertaId].slice(-MAX_ENCERRADOS);
  const motivos: Record<string, MotivoEncerramento> = {};
  for (const id of encerrados) {
    const m = id === alertaId ? motivo : e.motivos[id];
    if (m) motivos[id] = m;
  }
  return { ativos, encerrados, motivos };
};

export function reduzir(e: EstadoAlarmes, ev: EventoHub): { estado: EstadoAlarmes; efeitos: Efeito[] } {
  switch (ev.tipo) {
    case 'AlertaDisparado': {
      const { alertaId, ocorrenciaId, vitimaNome, origem, em } = ev.dado;
      if (conhecido(e, alertaId)) return { estado: e, efeitos: [] };
      const alerta: AlertaAtivo = { alertaId, ocorrenciaId, vitimaNome, origem, em, cienteEnviado: false };
      return { estado: { ...e, ativos: { ...e.ativos, [alertaId]: alerta } }, efeitos: [{ tipo: 'tocar', alerta }] };
    }
    case 'AlertaEscalado': {
      // O servidor manda AlertaEscalado a quem já foi acionado; se este aparelho não conhece
      // o alerta (perdeu o disparo), pede a lista de ativos ao servidor.
      if (conhecido(e, ev.dado.alertaId)) return { estado: e, efeitos: [] };
      return { estado: e, efeitos: [{ tipo: 'buscarAtivos' }] };
    }
    case 'AlertaEncerrado': {
      const { alertaId, motivo } = ev.dado;
      const estavaAtivo = alertaId in e.ativos;
      if (!estavaAtivo && e.encerrados.includes(alertaId)) return { estado: e, efeitos: [] };
      // Desconhecido também entra em `encerrados`: se o disparo chegar atrasado, não toca.
      const estado = encerrar(e, alertaId, motivo);
      return { estado, efeitos: estavaAtivo ? [{ tipo: 'parar', alertaId, motivo }] : [] };
    }
    case 'PassoAtualizado': {
      const { ocorrenciaId, passo, concluidoEm } = ev.dado;
      return { estado: e, efeitos: [{ tipo: 'passo', ocorrenciaId, passo, concluidoEm }] };
    }
    default:
      return { estado: e, efeitos: [] };
  }
}

const instante = (em: string) => {
  const t = Date.parse(em);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

// O mais antigo ainda sem "Estou ciente" enviado por este aparelho.
export function alertaEmDestaque(e: EstadoAlarmes): AlertaAtivo | undefined {
  let melhor: AlertaAtivo | undefined;
  for (const a of Object.values(e.ativos)) {
    if (a.cienteEnviado) continue;
    if (!melhor) {
      melhor = a;
      continue;
    }
    const ta = instante(a.em);
    const tm = instante(melhor.em);
    if (ta < tm || (ta === tm && a.alertaId < melhor.alertaId)) melhor = a;
  }
  return melhor;
}
