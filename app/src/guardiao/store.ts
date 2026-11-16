// Store dos alarmes do guardião. Só memória: sem `persist`, nada vai para SecureStore ou
// SQLite (o nome da vítima nunca é gravado em disco).
import { create } from 'zustand';

import type { AlertaDto } from '../api/tipos';
import { estadoInicial, reduzir, type Efeito, type EstadoAlarmes, type EventoHub } from './alarmeEstado';

type Alarmes = {
  estado: EstadoAlarmes;
  aplicar(ev: EventoHub): Efeito[];
  marcarCienteEnviado(alertaId: string): void;
  carregarAtivos(l: AlertaDto[]): Efeito[];
  /**
   * Lista do servidor (GET bem-sucedido) como fonte da verdade: toca o que é novo e encerra, com 'parar',
   * o ativo local que sumiu dela (o AlertaEncerrado se perdeu na queda). Preserva o que chegou pelo hub
   * depois de o pedido sair (`pedidoEm`, relógio local), o que já teve "Estou ciente" enviado e o de demonstração.
   */
  reconciliarAtivos(l: AlertaDto[], pedidoEm: number): Efeito[];
  // Volta ao estado vazio (logout / guardião desligado).
  limpar(): void;
};

// Quando cada alerta ativo chegou a este aparelho (relógio local), para a reconciliação não encerrar um
// disparo que chegou enquanto o GET dos ativos estava no ar. Só memória, como o resto.
const chegadas = new Map<string, number>();

function anotarChegadas(efeitos: Efeito[]): void {
  const agora = Date.now();
  for (const ef of efeitos) if (ef.tipo === 'tocar') chegadas.set(ef.alerta.alertaId, agora);
}

export const useAlarmes = create<Alarmes>()((set, get) => ({
  estado: estadoInicial(),

  aplicar(ev) {
    const { estado, efeitos } = reduzir(get().estado, ev);
    if (estado !== get().estado) set({ estado });
    anotarChegadas(efeitos);
    return efeitos;
  },

  marcarCienteEnviado(alertaId) {
    const atual = get().estado;
    const alerta = atual.ativos[alertaId];
    if (!alerta || alerta.cienteEnviado) return;
    set({ estado: { ...atual, ativos: { ...atual.ativos, [alertaId]: { ...alerta, cienteEnviado: true } } } });
  },

  carregarAtivos(l) {
    // Cada alerta da lista passa pelo mesmo reducer: já ativos e já encerrados não tocam de novo.
    let estado = get().estado;
    const efeitos: Efeito[] = [];
    for (const a of l) {
      const r = reduzir(estado, {
        tipo: 'AlertaDisparado',
        dado: { alertaId: a.alertaId, ocorrenciaId: a.ocorrenciaId, vitimaNome: a.vitimaNome, origem: a.origem, em: a.em },
      });
      estado = r.estado;
      efeitos.push(...r.efeitos);
    }
    if (estado !== get().estado) set({ estado });
    anotarChegadas(efeitos);
    return efeitos;
  },

  reconciliarAtivos(l, pedidoEm) {
    const efeitos = get().carregarAtivos(l);
    const naLista = new Set(l.map((a) => a.alertaId));
    let estado = get().estado;
    for (const a of Object.values(estado.ativos)) {
      if (naLista.has(a.alertaId) || a.cienteEnviado || a.ocorrenciaId.startsWith('demo-')) continue;
      if ((chegadas.get(a.alertaId) ?? 0) >= pedidoEm) continue;
      const r = reduzir(estado, { tipo: 'AlertaEncerrado', dado: { alertaId: a.alertaId, motivo: 'encerrado' } });
      estado = r.estado;
      efeitos.push(...r.efeitos);
      chegadas.delete(a.alertaId);
    }
    if (estado !== get().estado) set({ estado });
    return efeitos;
  },

  limpar() {
    chegadas.clear();
    set({ estado: estadoInicial() });
  },
}));
