// Tela de alarme do guardião (RF3). Sirene em loop e vibração até "Estou ciente"; o leitor de tela
// repete o aviso a cada 10 s. O ciente para o som na hora e é reenviado (2 s, 4 s, 8 s...) até o 204.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, BackHandler, ScrollView, StyleSheet, Vibration } from 'react-native';
import { ApiErro, mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { AlertaAtivo, MotivoEncerramento } from '../../guardiao/alarmeEstado';
import { cancelarAlarme, exibirAlarme, horaLocal, marcarAlarmeEmTela, rotuloOrigem } from '../../guardiao/notificacao';
import { useAlarmes } from '../../guardiao/store';
import { cores, espacos } from '../../theme/tokens';
import { BannerAlarme } from '../../ui/BannerAlarme';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';

const SIRENE = require('../../../assets/sirene.wav');

const VIBRACAO = [0, 500, 300, 500];
const REPETIR_ANUNCIO_MS = 10000;
/** Esperas entre as tentativas do ciente; depois da última, repete a última. */
export const ESPERAS_CIENTE_MS = [2000, 4000, 8000];

const MSG_ENCERRADO: Record<MotivoEncerramento, string> = {
  cancelado: 'Alerta cancelado. Você não precisa agir.',
  ciente: 'Outro guardião já assumiu. Você não precisa agir.',
  encerrado: 'Alerta encerrado. Você não precisa agir.',
};

type Fase = 'tocando' | 'enviando' | 'erro' | 'encerrado' | 'confirmado' | 'ausente';

/** 408 e 429 são transitórios: tratados como rede, com nova tentativa. */
const TRANSITORIOS = [408, 429];

const passoAPasso = (ocorrenciaId: string) => `/guardiao/passo-a-passo?ocorrenciaId=${encodeURIComponent(ocorrenciaId)}`;

export default function Alarme() {
  const router = useRouter();
  const { alertaId: param } = useLocalSearchParams<{ alertaId?: string }>();
  const alertaId = typeof param === 'string' ? param : '';
  const ativo = useAlarmes((s) => s.estado.ativos[alertaId]);
  const motivo = useAlarmes((s) => s.estado.motivos[alertaId]);
  const marcarCienteEnviado = useAlarmes((s) => s.marcarCienteEnviado);

  // Depois do encerramento o alerta sai do store; a tela continua mostrando quem era.
  const ultimo = useRef<AlertaAtivo | undefined>(ativo);
  if (ativo) ultimo.current = ativo;
  const alerta = ativo ?? ultimo.current;

  const [fase, setFase] = useState<Fase>(() => {
    if (ativo) return ativo.cienteEnviado ? 'confirmado' : 'tocando';
    return motivo ? 'encerrado' : 'ausente';
  });
  const [erro, setErro] = useState<string | undefined>();
  const faseRef = useRef(fase);
  faseRef.current = fase;

  // Só assume o alerta (cala a notificação, toca a sirene da tela) com o app em primeiro plano. Em segundo
  // plano ou com o aparelho bloqueado a notificação (tela cheia, som em loop) segue sozinha.
  const [ativa, setAtiva] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    setAtiva(AppState.currentState === 'active');
    const s = AppState.addEventListener('change', (e) => setAtiva(e === 'active'));
    return () => s.remove();
  }, []);

  const tocador = useAudioPlayer(SIRENE);
  const tocadorRef = useRef(tocador);
  tocadorRef.current = tocador;

  const enviando = useRef(false);
  const tentativa = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montada = useRef(true);

  const nome = alerta?.vitimaNome ?? '';
  const frase = `Alerta. ${nome} precisa de ajuda. Toque em Estou ciente para assumir.`;
  const fraseRef = useRef(frase);
  fraseRef.current = frase;

  function pararSom() {
    try {
      tocadorRef.current.pause();
    } catch {
      // tocador já liberado
    }
    Vibration.cancel();
  }

  function limparTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      limparTimer();
    };
  }, []);

  // A tela assume o alerta com o app ativo: a notificação sai (a sirene da tela toca no lugar). Indo
  // para segundo plano ou saindo sem o ciente, a notificação volta para continuar insistindo.
  useEffect(() => {
    if (!alertaId || !ativa) return;
    marcarAlarmeEmTela(alertaId, true);
    if (faseRef.current === 'tocando') void cancelarAlarme(alertaId).catch(() => undefined);
    return () => {
      marcarAlarmeEmTela(alertaId, false);
      const a = ultimo.current;
      if (faseRef.current === 'tocando' && a) void exibirAlarme(a).catch(() => undefined);
    };
  }, [alertaId, ativa]);

  const tocando = fase === 'tocando' && ativa;

  // Sirene, vibração e anúncio só enquanto toca e o app está em primeiro plano.
  useEffect(() => {
    if (!tocando) return;
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(
      () => undefined,
    );
    const p = tocadorRef.current;
    p.loop = true;
    p.play();
    Vibration.vibrate(VIBRACAO, true);
    const anunciar = () => AccessibilityInfo.announceForAccessibility(fraseRef.current);
    anunciar();
    const intervalo = setInterval(anunciar, REPETIR_ANUNCIO_MS);
    return () => {
      clearInterval(intervalo);
      pararSom();
    };
  }, [tocando]);

  // O botão voltar não cala o alarme nem abandona o envio do ciente.
  const travada = fase === 'tocando' || fase === 'enviando';
  useEffect(() => {
    if (!travada) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => s.remove();
  }, [travada]);

  // AlertaEncerrado com a tela aberta (cancelamento, fim ou ciente de outro guardião).
  useEffect(() => {
    if (ativo || !motivo) return;
    const f = faseRef.current;
    // Enviando, um "ciente" pode ser o nosso (resposta perdida): o envio segue e o servidor decide.
    if (f === 'tocando' || f === 'erro' || (f === 'enviando' && motivo !== 'ciente')) {
      enviando.current = false;
      limparTimer();
      pararSom();
      setFase('encerrado');
    }
  }, [ativo, motivo]);

  async function enviar() {
    const a = ultimo.current;
    if (!a) return;
    try {
      await api.alertas.ciente(a.alertaId);
    } catch (e) {
      if (!montada.current || !enviando.current) return;
      if (e instanceof ApiErro && e.status >= 400 && e.status < 500 && !TRANSITORIOS.includes(e.status)) {
        // recusa do servidor: repetir não muda nada
        enviando.current = false;
        setErro(mensagemDeErro(e));
        setFase('erro');
        return;
      }
      const espera = ESPERAS_CIENTE_MS[Math.min(tentativa.current, ESPERAS_CIENTE_MS.length - 1)];
      tentativa.current += 1;
      timer.current = setTimeout(() => void enviar(), espera);
      return;
    }
    if (!montada.current || !enviando.current) return;
    enviando.current = false;
    marcarCienteEnviado(a.alertaId);
    router.replace(passoAPasso(a.ocorrenciaId) as never);
  }

  function estouCiente() {
    if (enviando.current || !ultimo.current) return;
    enviando.current = true;
    tentativa.current = 0;
    pararSom();
    setErro(undefined);
    setFase('enviando');
    void cancelarAlarme(alertaId).catch(() => undefined);
    void enviar();
  }

  const corTexto = { color: cores.sobreAlarme };
  const hora = alerta ? horaLocal(alerta.em) : '';

  return (
    <ScrollView testID="tela-alarme" style={estilos.fundo} contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <BannerAlarme />
      <Texto variante="titulo" style={[estilos.titulo, corTexto]}>
        {alerta ? `Alerta: ${nome} precisa de ajuda` : 'Alerta'}
      </Texto>
      {alerta ? <Texto style={corTexto}>{`${rotuloOrigem(alerta.origem)} · ${hora}`}</Texto> : null}

      {fase === 'tocando' ? (
        <Botao
          rotulo="Estou ciente"
          variante="secundario"
          dica="Para a sirene e avisa que você vai ajudar."
          onPress={estouCiente}
        />
      ) : null}

      {fase === 'enviando' ? (
        <>
          <ActivityIndicator color={cores.sobreAlarme} accessibilityLabel="Enviando" />
          <Texto style={corTexto} accessibilityLiveRegion="polite">
            Enviando sua confirmação…
          </Texto>
        </>
      ) : null}

      {fase === 'erro' ? (
        <>
          <Texto style={corTexto} accessibilityLiveRegion="assertive">{`⚠ ${erro ?? ''}`}</Texto>
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={estouCiente} />
        </>
      ) : null}

      {fase === 'encerrado' && motivo ? (
        <>
          <Texto style={corTexto} accessibilityLiveRegion="assertive">
            {MSG_ENCERRADO[motivo]}
          </Texto>
          <Botao rotulo="Voltar ao início" variante="secundario" onPress={() => router.replace('/')} />
        </>
      ) : null}

      {fase === 'confirmado' && alerta ? (
        <>
          <Texto style={corTexto}>Você já confirmou este alerta.</Texto>
          <Botao
            rotulo="Abrir o passo a passo"
            variante="secundario"
            onPress={() => router.replace(passoAPasso(alerta.ocorrenciaId) as never)}
          />
        </>
      ) : null}

      {fase === 'ausente' || (fase === 'encerrado' && !motivo) ? (
        <>
          <Texto style={corTexto}>Este alerta não está mais ativo.</Texto>
          <Botao rotulo="Voltar ao início" variante="secundario" onPress={() => router.replace('/')} />
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.alarme },
  tela: { flexGrow: 1, padding: espacos.g, gap: espacos.m, justifyContent: 'center' },
  titulo: { fontSize: 32, lineHeight: 40 },
});
