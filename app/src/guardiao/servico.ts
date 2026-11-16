// Serviço em primeiro plano do guardião: mantém o processo vivo com a notificação fixa
// "Ampara está de olho" e a conexão SignalR com /hubs/guardiao. Importado em index.ts antes do
// expo-router: o notifee exige o registerForegroundService no escopo do módulo.
import notifee, { AndroidForegroundServiceType } from '@notifee/react-native';
import { tokenAtual } from '../api/cliente';
import { api } from '../api/endpoints';
import { aoSair } from '../auth/sessao';
import { API_URL } from '../config';
import { abrirBanco } from '../db/db';
import { sessaoRepo } from '../db/repos';
import type { Efeito } from './alarmeEstado';
import { criarHub } from './hub';
import { CANAL_SERVICO, cancelarAlarme, criarCanais, exibirAlarme } from './notificacao';
import { useAlarmes } from './store';

export const ID_NOTIFICACAO_SERVICO = 'ampara-guardiao-servico';
/** Espera antes de abrir uma conexão nova quando o hub não conecta ou desiste de reconectar. */
export const ESPERAS_NOVA_CONEXAO_MS = [2000, 5000, 10000, 30000];

type Hub = ReturnType<typeof criarHub>;

let hub: Hub | null = null;
let iniciando: Promise<void> | null = null;
// Muda a cada parada: o que estava em andamento (início, nova tentativa) vê que ficou velho e desiste.
let geracao = 0;
let tentativa = 0;
let timerConexao: ReturnType<typeof setTimeout> | null = null;
let fimDoServico: (() => void) | null = null;

/** Registra a tarefa do serviço em primeiro plano (vive até pararServicoGuardiao). */
export function registrarServicoPrimeiroPlano(): void {
  notifee.registerForegroundService(
    () =>
      new Promise<void>((resolve) => {
        fimDoServico = resolve;
      }),
  );
}

registrarServicoPrimeiroPlano();
// Toques na notificação com o app em segundo plano: abrir o app basta (o _layout leva ao alarme).
notifee.onBackgroundEvent(async () => undefined);

async function buscarAtivos(): Promise<void> {
  try {
    const lista = await api.alertas.ativos();
    await executarEfeitos(useAlarmes.getState().carregarAtivos(lista));
  } catch {
    console.warn('guardiao: falha ao buscar alertas ativos');
  }
}

async function executarEfeitos(efeitos: Efeito[]): Promise<void> {
  for (const ef of efeitos) {
    try {
      if (ef.tipo === 'tocar') await exibirAlarme(ef.alerta);
      else if (ef.tipo === 'parar') await cancelarAlarme(ef.alertaId);
      else if (ef.tipo === 'buscarAtivos') await buscarAtivos();
      // 'passo': atualização do passo a passo, tratada pela tela do guardião
    } catch {
      console.warn(`guardiao: efeito ${ef.tipo} falhou`);
    }
  }
}

function agendarNovaConexao(g: number): void {
  if (g !== geracao || !hub || timerConexao) return;
  const espera = ESPERAS_NOVA_CONEXAO_MS[Math.min(tentativa, ESPERAS_NOVA_CONEXAO_MS.length - 1)];
  tentativa += 1;
  timerConexao = setTimeout(() => {
    timerConexao = null;
    void conectar(g);
  }, espera);
}

async function conectar(g: number): Promise<void> {
  const h = hub;
  if (!h || g !== geracao) return;
  try {
    await h.iniciar();
  } catch {
    agendarNovaConexao(g);
    return;
  }
  if (g !== geracao) return;
  tentativa = 0;
  await buscarAtivos();
}

async function iniciar(): Promise<void> {
  if (hub) return;
  if ((await sessaoRepo(await abrirBanco()).get('guardiao_ativo')) !== '1') return;
  const g = geracao;
  await criarCanais();
  await notifee.displayNotification({
    id: ID_NOTIFICACAO_SERVICO,
    title: 'Ampara está de olho: você é guardião',
    body: 'Se alguém que você protege pedir ajuda, o alarme toca aqui.',
    android: {
      channelId: CANAL_SERVICO,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      ongoing: true,
      pressAction: { id: 'default', launchActivity: 'default' },
    },
  });
  if (g !== geracao || hub) return; // parado (logout) enquanto subia
  hub = criarHub({
    baseUrl: API_URL,
    obterToken: () => tokenAtual() ?? '',
    aoEvento: (ev) => void executarEfeitos(useAlarmes.getState().aplicar(ev)),
    aoEstado: (s) => {
      if (s === 'desconectado') agendarNovaConexao(g);
    },
    aoReconectar: () => void buscarAtivos(),
  });
  await conectar(g);
}

/** Sobe o serviço e a conexão do guardião se `sessao.guardiao_ativo === '1'`. Chamadas repetidas são inócuas. */
export function iniciarServicoGuardiao(): Promise<void> {
  if (!iniciando) {
    iniciando = iniciar().finally(() => {
      iniciando = null;
    });
  }
  return iniciando;
}

/** Fecha a conexão, derruba o serviço, cala os alarmes e esquece os alertas (logout). Nunca lança. */
export async function pararServicoGuardiao(): Promise<void> {
  geracao += 1;
  if (timerConexao) clearTimeout(timerConexao);
  timerConexao = null;
  tentativa = 0;
  const h = hub;
  hub = null;
  const alertas = Object.keys(useAlarmes.getState().estado.ativos);
  useAlarmes.getState().limpar();
  try {
    await h?.parar();
  } catch {
    console.warn('guardiao: falha ao fechar o hub');
  }
  for (const id of alertas) {
    try {
      await cancelarAlarme(id);
    } catch {
      // segue cancelando os outros
    }
  }
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(ID_NOTIFICACAO_SERVICO);
  } catch {
    console.warn('guardiao: falha ao parar o servico');
  }
  fimDoServico?.();
  fimDoServico = null;
}

aoSair(() => {
  void pararServicoGuardiao();
});
