// Serviço em primeiro plano do guardião: mantém o processo vivo com a notificação fixa
// "Ampara está de olho" e a conexão SignalR com /hubs/guardiao. Importado em index.ts antes do
// expo-router: o notifee exige o registerForegroundService no escopo do módulo.
import notifee, { AndroidForegroundServiceType } from '@notifee/react-native';
import { tokenAtual } from '../api/cliente';
import { api } from '../api/endpoints';
import { aoSair, aoTrocarConta } from '../auth/sessao';
import { API_URL } from '../config';
import { abrirBanco } from '../db/db';
import { sessaoRepo } from '../db/repos';
import type { Efeito } from './alarmeEstado';
import { criarHub } from './hub';
import { emitirPasso } from './passosAoVivo';
import { CANAL_ALARME, CANAL_SERVICO, cancelarAlarme, criarCanais, exibirAlarme, exibirAviso, permissaoNotificacao } from './notificacao';
import { useAlarmes } from './store';

export const ID_NOTIFICACAO_SERVICO = 'ampara-guardiao-servico';
/** Aviso deixado quando a sessão expira com o papel de guardião ligado (item 8 da revisão). */
export const ID_AVISO_SESSAO = 'ampara-guardiao-sessao-expirada';
export const AVISO_SESSAO_TITULO = 'Entre de novo para receber alarmes';
const AVISO_SESSAO_CORPO = 'Sua sessão terminou. O alarme de guardião fica desligado até você entrar de novo no Ampara.';
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
    const pedidoEm = Date.now();
    const lista = await api.alertas.ativos();
    // A lista é a verdade (item 7): o que sumiu dela foi encerrado enquanto o hub estava fora.
    await executarEfeitos(useAlarmes.getState().reconciliarAtivos(lista, pedidoEm));
    await cancelarAlarmesOrfaos(new Set(lista.map((a) => a.alertaId)));
  } catch {
    console.warn('guardiao: falha ao buscar alertas ativos');
  }
}

/** Notificação de alarme que ficou na bandeja (ex.: de antes de o processo reiniciar) sem alerta ativo. */
async function cancelarAlarmesOrfaos(ativosNoServidor: Set<string>): Promise<void> {
  try {
    const locais = useAlarmes.getState().estado.ativos;
    for (const n of await notifee.getDisplayedNotifications()) {
      if (n.notification.android?.channelId !== CANAL_ALARME) continue;
      const alertaId = String(n.notification.data?.alertaId ?? n.id ?? '');
      if (!alertaId || ativosNoServidor.has(alertaId) || alertaId in locais) continue;
      await cancelarAlarme(n.id ?? alertaId);
    }
  } catch {
    console.warn('guardiao: falha ao limpar alarmes antigos');
  }
}

async function executarEfeitos(efeitos: Efeito[]): Promise<void> {
  for (const ef of efeitos) {
    try {
      if (ef.tipo === 'tocar') await exibirAlarme(ef.alerta);
      else if (ef.tipo === 'parar') await cancelarAlarme(ef.alertaId);
      else if (ef.tipo === 'buscarAtivos') await buscarAtivos();
      else if (ef.tipo === 'passo') emitirPasso({ ocorrenciaId: ef.ocorrenciaId, passo: ef.passo, concluidoEm: ef.concluidoEm });
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
  const g = geracao;
  if ((await sessaoRepo(await abrirBanco()).get('guardiao_ativo')) === '0') return;
  if (g !== geracao) return;
  // Entrou de novo: o aviso de sessão expirada não vale mais.
  await notifee.cancelNotification(ID_AVISO_SESSAO).catch(() => undefined);
  // Android 13+: sem POST_NOTIFICATIONS nem o alarme nem o aviso fixo aparecem. Negada não impede o
  // serviço (o BannerAlarme avisa e leva a Ajustes).
  await permissaoNotificacao(true).catch(() => undefined);
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
  if (g !== geracao) {
    // parado (logout) enquanto subia: o serviço que acabou de subir não pode ficar sem dono
    await derrubarServico();
    return;
  }
  if (hub) return;
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

/** Sobe o serviço e a conexão do guardião, a menos que `sessao.guardiao_ativo === '0'` (sem valor = ligado). Chamadas repetidas são inócuas. */
export function iniciarServicoGuardiao(): Promise<void> {
  if (!iniciando) {
    const p: Promise<void> = iniciar().finally(() => {
      if (iniciando === p) iniciando = null;
    });
    iniciando = p;
  }
  return iniciando;
}

async function derrubarServico(): Promise<void> {
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(ID_NOTIFICACAO_SERVICO);
  } catch {
    console.warn('guardiao: falha ao parar o servico');
  }
  fimDoServico?.();
  fimDoServico = null;
}

/** Fecha a conexão, derruba o serviço, cala os alarmes e esquece os alertas (logout). Nunca lança. */
export async function pararServicoGuardiao(): Promise<void> {
  geracao += 1;
  iniciando = null; // um novo login logo depois não reaproveita um início que já ficou velho
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
  await derrubarServico();
}

/** Sessão expirada com o papel de guardião ligado: avisa em vez de desligar em silêncio. */
async function avisarSessaoExpirada(): Promise<void> {
  try {
    if ((await sessaoRepo(await abrirBanco()).get('guardiao_ativo')) === '0') return;
    await exibirAviso(ID_AVISO_SESSAO, AVISO_SESSAO_TITULO, AVISO_SESSAO_CORPO);
  } catch {
    console.warn('guardiao: falha ao avisar a sessao expirada');
  }
}

// Saída manual: para tudo (o SQLite já foi apagado, guardiao_ativo junto). Expirou: sem token o hub não
// conecta, então o serviço para, mas guardiao_ativo fica e o novo login sobe tudo de novo; até lá, o aviso.
// Sessão de emergência (aparelho emprestado) nunca subiu o serviço: nada a fazer.
aoSair(({ motivo, escopo }) => {
  if (escopo === 'emergencia') return;
  void pararServicoGuardiao().then(() => (motivo === 'expirou' ? avisarSessaoExpirada() : undefined));
});

// Outra conta entrou no aparelho (item A): o papel de guardião era da conta anterior, assim como o aviso de
// sessão expirada dela.
aoTrocarConta(async () => {
  await pararServicoGuardiao();
  await notifee.cancelNotification(ID_AVISO_SESSAO).catch(() => undefined);
});
