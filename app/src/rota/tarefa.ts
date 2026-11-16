// Rota em segundo plano: a tarefa é definida no escopo do módulo (importado em index.ts antes do expo-router),
// porque o Android pode acordar o JS só para rodar a tarefa, sem montar nenhuma tela.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { api } from '../api/endpoints';
import { restaurar, sessaoAtual } from '../auth/sessao';
import { abrirBanco } from '../db/db';
import { rotaRepo, sessaoRepo, type PontoRota } from '../db/repos';
import { enviarPendentes, registrarPontos } from './fila';

export const NOME_TAREFA = 'ampara-rota';
export type EstadoRota = 'ativa' | 'sem-consentimento' | 'sem-permissao' | 'pausada';

/** Consentimento local (o servidor guarda o oficial; aqui é o que o aparelho sabe sem rede). */
const CHAVE_CONSENTIMENTO = 'rota.consentimento';

const temConsentimento = async (): Promise<boolean> =>
  (await sessaoRepo(await abrirBanco()).get(CHAVE_CONSENTIMENTO)) === 'sim';

type DadosTarefa = { locations?: Location.LocationObject[] } | undefined;

// Posição sem precisão conhecida vira "infinita" e é descartada pela fila (limite de 150 m).
const paraPonto = (l: Location.LocationObject): PontoRota => ({
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  precisao: l.coords.accuracy ?? Number.POSITIVE_INFINITY,
  em: new Date(l.timestamp).toISOString(),
});

TaskManager.defineTask<DadosTarefa>(NOME_TAREFA, async ({ data, error }) => {
  if (error) {
    console.warn('rota: a tarefa de localizacao informou erro');
    return;
  }
  try {
    // Sem consentimento local (logout manual apagou o banco, revogação): não grava nada e desliga a coleta.
    // Sessão expirada não chega aqui: o consentimento fica e os pontos esperam o novo login na fila.
    if (!(await temConsentimento())) {
      await pararRota(true);
      return;
    }
    const locais = data?.locations ?? [];
    // grava primeiro: se o envio falhar ou o processo morrer, nada se perde
    if (locais.length > 0) await registrarPontos(await abrirBanco(), locais.map(paraPonto));
  } catch {
    console.warn('rota: falha ao gravar pontos');
  }
  await sincronizarAgora();
});

let sincronizando: Promise<void> | null = null;

/**
 * Envia a fila (lotes de 500) se houver sessão de usuário; nunca lança. Chamado em cada callback da tarefa e
 * quando o app volta ao primeiro plano. Execuções simultâneas reaproveitam a que já está em andamento.
 */
export function sincronizarAgora(): Promise<void> {
  if (!sincronizando) {
    const execucao = (async () => {
      try {
        // Com o app fechado o JS acorda sem sessão em memória: recupera o token salvo.
        if (!sessaoAtual().autenticado) await restaurar();
        // O token de emergência (aparelho de outra pessoa) não envia rota.
        if (sessaoAtual().escopo !== 'usuario') return;
        // Sem consentimento neste aparelho, a fila não sai (pode ser de outra conta ou de antes da revogação).
        if (!(await temConsentimento())) return;
        await enviarPendentes(await abrirBanco(), (lote) => api.rota.enviarPontos(lote));
      } catch {
        console.warn('rota: falha ao sincronizar a fila');
      }
    })();
    // A trava é solta num .finally encadeado (sempre assíncrono): um corpo que termina sem nenhum await
    // não pode soltar a trava antes de ela ser atribuída e deixá-la presa para sempre.
    sincronizando = execucao.finally(() => {
      sincronizando = null;
    });
  }
  return sincronizando;
}

/** Marca o consentimento neste aparelho e liga a tarefa (precisa da permissão de localização com o app aberto). */
export async function iniciarRota(): Promise<void> {
  await sessaoRepo(await abrirBanco()).set(CHAVE_CONSENTIMENTO, 'sim');
  const permissao = await Location.getForegroundPermissionsAsync();
  if (!permissao.granted) return;
  // Precisão alta: no spike, Balanced entregou 0 pontos no emulador.
  await Location.startLocationUpdatesAsync(NOME_TAREFA, {
    accuracy: Location.Accuracy.High,
    timeInterval: 60000,
    distanceInterval: 50,
    foregroundService: {
      notificationTitle: 'Ampara guardando sua rota (7 dias)',
      notificationBody: 'Só você vê. Desligue quando quiser em Ajustes.',
    },
  });
}

/**
 * Depois de entrar (item 4 da revisão): se este aparelho não tem decisão local sobre a rota (logout manual,
 * aparelho novo) e o servidor guarda o consentimento, religa a coleta; depois envia a fila guardada enquanto
 * a sessão estava vencida (sem esperar o envio). 'nao' local (a pessoa desligou aqui) nunca é desfeito. Nunca lança.
 */
export async function retomarRotaAposEntrar(): Promise<void> {
  try {
    const local = await sessaoRepo(await abrirBanco()).get(CHAVE_CONSENTIMENTO);
    if (local === null && (await api.me.obter()).consentimentoRota === true) await iniciarRota();
  } catch {
    console.warn('rota: falha ao retomar a rota depois de entrar');
  }
  // Sem esperar: a tela não fica parada enquanto a fila sobe (sem rede, só no timeout).
  void sincronizarAgora();
}

export async function pararRota(apagarFila: boolean): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(NOME_TAREFA)) {
    await Location.stopLocationUpdatesAsync(NOME_TAREFA);
  }
  if (apagarFila) await rotaRepo(await abrirBanco()).apagarTudo();
}

export async function estadoRota(): Promise<EstadoRota> {
  if ((await sessaoRepo(await abrirBanco()).get(CHAVE_CONSENTIMENTO)) !== 'sim') return 'sem-consentimento';
  const [primeiro, fundo] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
  if (!primeiro.granted || !fundo.granted) return 'sem-permissao';
  return (await TaskManager.isTaskRegisteredAsync(NOME_TAREFA)) ? 'ativa' : 'pausada';
}

/**
 * Avisa o servidor, para a tarefa e apaga a fila. A parada local acontece mesmo se a API falhar
 * (a pessoa pediu para parar); o erro da API é repassado para a tela mostrar.
 */
export async function revogarConsentimento(): Promise<void> {
  let erroApi: unknown = null;
  try {
    await api.me.consentimentoRota(false);
  } catch (e) {
    erroApi = e;
  }
  await sessaoRepo(await abrirBanco()).set(CHAVE_CONSENTIMENTO, 'nao');
  await pararRota(true);
  if (erroApi) throw erroApi;
}

AppState.addEventListener('change', (estado) => {
  if (estado === 'active') void sincronizarAgora();
});
