// Tela de alarme do guardião (RF3). Sirene em loop e vibração até "Estou ciente"; o leitor de tela
// repete o aviso a cada 10 s. O ciente para o som na hora e é reenviado (2 s, 4 s, 8 s...) até o 204.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { AccessibilityInfo, AppState, BackHandler, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiErro, mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { AlertaAtivo, MotivoEncerramento } from '../../guardiao/alarmeEstado';
import { PREFIXO_DEMO } from '../../guardiao/eventos';
import { cancelarAlarme, exibirAlarme, horaLocal, marcarAlarmeEmTela, rotuloOrigem } from '../../guardiao/notificacao';
import { useAlarmes } from '../../guardiao/store';
import { cores, espacos } from '../../theme/tokens';
import { BannerAlarme } from '../../ui/BannerAlarme';
import { BarraAcao } from '../../ui/BarraAcao';
import { Botao } from '../../ui/Botao';
import { Icone } from '../../ui/Icone';
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

/** O que o toque faz, dito antes do toque (também é a frase anunciada ao leitor de tela). */
export const FRASE_ACAO = 'Toque em Estou ciente para avisar que você vai ajudar.';

type Fase = 'tocando' | 'enviando' | 'erro' | 'encerrado' | 'confirmado' | 'ausente';

/** 408 e 429 são transitórios: tratados como rede, com nova tentativa. */
const TRANSITORIOS = [408, 429];

const passoAPasso = (ocorrenciaId: string) => `/guardiao/passo-a-passo?ocorrenciaId=${encodeURIComponent(ocorrenciaId)}`;

export default function Alarme() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const frase = `Alerta. ${nome} precisa de ajuda. ${FRASE_ACAO}`;
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
      // Modo demonstração (ocorrência demo-…): o ciente é só local, sem servidor nem internet.
      if (!a.ocorrenciaId.startsWith(PREFIXO_DEMO)) await api.alertas.ciente(a.alertaId);
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
    // Uma batida forte e curta confirma o toque, depois de calar a sirene.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    setErro(undefined);
    setFase('enviando');
    void cancelarAlarme(alertaId).catch(() => undefined);
    void enviar();
  }


  const hora = alerta ? horaLocal(alerta.em) : '';
  const fimDeLinha = fase === 'encerrado' || fase === 'ausente';

  // Uma ação por fase, sempre no mesmo lugar (base, 64 dp): o polegar não procura o botão.
  let acao: { rotulo: string; dica?: string; onPress?: () => void; carregando?: boolean };
  if (fase === 'tocando') {
    acao = { rotulo: 'Estou ciente', dica: 'Para a sirene e avisa que você vai ajudar.', onPress: estouCiente };
  } else if (fase === 'enviando') {
    acao = { rotulo: 'Enviando…', carregando: true };
  } else if (fase === 'erro') {
    acao = { rotulo: 'Tentar de novo', onPress: estouCiente };
  } else if (fase === 'confirmado' && alerta) {
    acao = { rotulo: 'Abrir o passo a passo', onPress: () => router.replace(passoAPasso(alerta.ocorrenciaId) as never) };
  } else {
    acao = { rotulo: 'Voltar ao início', onPress: () => router.replace('/') };
  }

  return (
    <View style={estilos.fundo}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Faixa de cima: quem fala e quando. */}
      <View style={[estilos.topo, { paddingTop: insets.top + espacos.m }]}>
        <Texto variante="rotulo" style={estilos.sobre}>
          Ampara
        </Texto>
        {alerta && hora ? <Texto variante="rotulo" style={estilos.sobre}>{`Às ${hora}`}</Texto> : null}
      </View>

      {/* Faixa do meio: o que aconteceu e o que fazer. Rola com fonte grande; a base não sai do lugar. */}
      <ScrollView testID="tela-alarme" style={estilos.meio} contentContainerStyle={estilos.conteudo}>
        <BannerAlarme />

        {fimDeLinha ? (
          <>
            <Icone nome={fase === 'encerrado' ? 'ok' : 'info'} tamanho={40} cor={cores.sobreAlarme} />
            <Texto variante="exibicao" style={estilos.sobre} accessibilityLiveRegion="assertive">
              {fase === 'encerrado' && motivo ? MSG_ENCERRADO[motivo] : 'Este alerta não está mais ativo.'}
            </Texto>
          </>
        ) : (
          <>
            <Icone nome="alerta" tamanho={40} cor={cores.sobreAlarme} />
            <Texto variante="exibicao" style={estilos.sobre}>
              {alerta ? `${nome} precisa de ajuda` : 'Alerta'}
            </Texto>

            {fase === 'tocando' ? (
              <Texto variante="corpoForte" style={estilos.sobre}>
                {FRASE_ACAO}
              </Texto>
            ) : null}
            {fase === 'enviando' ? (
              <Texto variante="corpoForte" style={estilos.sobre} accessibilityLiveRegion="polite">
                Enviando sua confirmação…
              </Texto>
            ) : null}
            {fase === 'erro' ? (
              <View style={estilos.linha} accessibilityLiveRegion="assertive">
                <Icone nome="alerta" tamanho={24} cor={cores.sobreAlarme} />
                <Texto variante="corpoForte" style={[estilos.sobre, estilos.fluxo]}>
                  {erro ?? ''}
                </Texto>
              </View>
            ) : null}
            {fase === 'confirmado' ? (
              <Texto variante="corpoForte" style={estilos.sobre}>
                Você já confirmou este alerta.
              </Texto>
            ) : null}

            {alerta ? <Texto style={estilos.sobre}>{`Origem do aviso: ${rotuloOrigem(alerta.origem)}.`}</Texto> : null}
            {fase === 'tocando' || fase === 'enviando' ? (
              <Texto style={estilos.sobre}>O botão voltar fica travado até você confirmar.</Texto>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Faixa de baixo: a ação, ancorada sob o polegar e acima da barra de gestos. */}
      <BarraAcao semSombra>
        <Botao
          rotulo={acao.rotulo}
          variante="sobreAlarme"
          dica={acao.dica}
          carregando={acao.carregando}
          onPress={acao.onPress ?? (() => undefined)}
          haptica={false}
        />
      </BarraAcao>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.alarme },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: espacos.m,
    paddingBottom: espacos.p,
  },
  meio: { flex: 1 },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.m, paddingVertical: espacos.g, gap: espacos.m, alignItems: 'flex-start' },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espacos.p },
  fluxo: { flex: 1 },
  sobre: { color: cores.sobreAlarme },
});
