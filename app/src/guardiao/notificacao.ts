// Notificações do guardião (notifee): canal do alarme insistente e canal do serviço em primeiro plano.
// O alarme toca pela notificação (som do canal em loop, vibração, tela cheia) até a tela de alarme abrir.
import notifee, { AndroidCategory, AndroidImportance, AndroidVisibility, AuthorizationStatus } from '@notifee/react-native';
import { abrirBanco } from '../db/db';
import { sessaoRepo } from '../db/repos';
import type { AlertaAtivo } from './alarmeEstado';

export const CANAL_ALARME = 'ampara-alarme';
export const CANAL_SERVICO = 'ampara-servico';
/** Avisos que a pessoa precisa ver (ex.: sessão expirada desligou o alarme), sem sirene. */
export const CANAL_AVISO = 'ampara-aviso';

/** Chave em `sessao`: '1' = "Alarme sem tela cheia" (plano B, toggle em Ajustes). */
export const CHAVE_PLANO_B = 'alarme_plano_b';

const VIBRACAO = [300, 500, 300, 500];
const ABRIR_APP = { id: 'default', launchActivity: 'default' };
const FUSO = 'America/Sao_Paulo';

const ORIGENS: Record<string, string> = {
  chaveiro: 'Chaveiro',
  web: 'Página de emergência',
  guardiao: 'Outro guardião',
  impacto: 'Impacto detectado',
};

/** Origem do alerta em português (contrato: chaveiro | web | guardiao | impacto). */
export function rotuloOrigem(origem: string): string {
  return ORIGENS[origem] ?? origem;
}

/** Hora local (HH:mm, America/Sao_Paulo); vazio se a data não for válida. */
export function horaLocal(em: string): string {
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });
}

export async function criarCanais(): Promise<void> {
  await notifee.createChannel({
    id: CANAL_ALARME,
    name: 'Alarme de guardião',
    description: 'Toca quando alguém que você protege precisa de ajuda.',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: VIBRACAO,
    sound: 'default',
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id: CANAL_SERVICO,
    name: 'Ampara de olho',
    description: 'Aviso fixo enquanto o app escuta os alarmes de guardião.',
    importance: AndroidImportance.LOW,
  });
}

let canais: Promise<void> | null = null;

/** Cria os canais uma vez por processo (falhou, tenta de novo na próxima). */
function garantirCanais(): Promise<void> {
  if (!canais) {
    canais = criarCanais().catch((e) => {
      canais = null;
      throw e;
    });
  }
  return canais;
}

async function planoBLigado(): Promise<boolean> {
  try {
    return (await sessaoRepo(await abrirBanco()).get(CHAVE_PLANO_B)) === '1';
  } catch {
    return false; // sem o banco, fica a tela cheia (o padrão)
  }
}

// Alertas com a tela de alarme aberta: a sirene da tela toca, a notificação não (senão são dois sons).
const emTela = new Set<string>();

/** A tela de alarme avisa quando assume (true) e quando solta (false) o alerta. */
export function marcarAlarmeEmTela(alertaId: string, aberta: boolean): void {
  if (aberta) emTela.add(alertaId);
  else emTela.delete(alertaId);
}

/** Mostra o alarme do alerta. Sem `o`, a tela cheia segue o toggle `alarme_plano_b`. */
export async function exibirAlarme(a: AlertaAtivo, o?: { telaCheia: boolean }): Promise<void> {
  const telaCheia = o ? o.telaCheia : !(await planoBLigado());
  await garantirCanais();
  // a tela pode ter aberto enquanto o canal e o banco respondiam
  if (emTela.has(a.alertaId)) return;
  const hora = horaLocal(a.em);
  await notifee.displayNotification({
    id: a.alertaId,
    title: `Alerta: ${a.vitimaNome} precisa de ajuda`,
    body: `${rotuloOrigem(a.origem)}${hora ? `, às ${hora}` : ''}. Toque para abrir e assumir.`,
    data: { alertaId: a.alertaId },
    android: {
      channelId: CANAL_ALARME,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibrationPattern: VIBRACAO,
      sound: 'default',
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      pressAction: ABRIR_APP,
      fullScreenAction: telaCheia ? ABRIR_APP : undefined,
    },
  });
}

export async function cancelarAlarme(alertaId: string): Promise<void> {
  await notifee.cancelNotification(alertaId);
}

/** 'ok' se o app pode notificar. `pedir=false` só consulta, sem abrir o pedido do sistema. */
export async function permissaoNotificacao(pedir = true): Promise<'ok' | 'negada'> {
  const s = pedir ? await notifee.requestPermission() : await notifee.getNotificationSettings();
  return s.authorizationStatus >= AuthorizationStatus.AUTHORIZED ? 'ok' : 'negada';
}

/** Notificação comum (sem sirene) com um aviso que a pessoa precisa ver. */
export async function exibirAviso(id: string, titulo: string, corpo: string): Promise<void> {
  await notifee.createChannel({
    id: CANAL_AVISO,
    name: 'Avisos do Ampara',
    description: 'Avisos importantes, como o alarme de guardião desligado.',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.displayNotification({
    id,
    title: titulo,
    body: corpo,
    android: { channelId: CANAL_AVISO, pressAction: ABRIR_APP },
  });
}
