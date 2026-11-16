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
  // Volta ao estado vazio (logout / guardião desligado).
  limpar(): void;
};

export const useAlarmes = create<Alarmes>()((set, get) => ({
  estado: estadoInicial(),

  aplicar(ev) {
    const { estado, efeitos } = reduzir(get().estado, ev);
    if (estado !== get().estado) set({ estado });
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
    return efeitos;
  },

  limpar() {
    set({ estado: estadoInicial() });
  },
}));
