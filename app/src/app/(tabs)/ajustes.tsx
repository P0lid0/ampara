// Aba Ajustes: chaveiro, rota, guardião, alarme, modo demonstração, sair e "Sobre".
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { ChaveiroDto } from '../../api/tipos';
import { sair } from '../../auth/sessao';
import { escolher, rotuloStatus } from '../../chaveiro/status';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { gerarEventoDemo, handleEvent, PREFIXO_DEMO, useAvisoChaveiro, type EventoChaveiro } from '../../guardiao/eventos';
import { CHAVE_PLANO_B } from '../../guardiao/notificacao';
import { iniciarServicoGuardiao, pararServicoGuardiao } from '../../guardiao/servico';
import { revogarConsentimento } from '../../rota/tarefa';
import { cores, espacos, tamanhos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';

export const FRASE_SOBRE = 'O Ampara não bloqueia o seu celular nem as suas contas: ele avisa quem pode fazer isso.';
// SINTETICO: chaveiro de demonstração (contrato: chaveiro-ampara- + 6 hex).
export const DEVICE_DEMO = 'chaveiro-ampara-0de300';

const CHAVE_DEMO = 'demo';
const CHAVE_GUARDIAO = 'guardiao_ativo';
const CHAVE_CONSENTIMENTO = 'rota.consentimento';
const AVISO_ACHAR = 'O chaveiro vai piscar e tocar por 6 segundos.';

type Chaves = { guardiao: boolean; planoB: boolean; demo: boolean };

function Interruptor({ rotulo, dica, valor, aoMudar }: { rotulo: string; dica: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <View style={estilos.linha}>
      <View style={estilos.linhaTexto}>
        <Texto>{rotulo}</Texto>
        <Texto variante="legenda">{dica}</Texto>
      </View>
      <Switch
        accessibilityLabel={rotulo}
        accessibilityHint={dica}
        value={valor}
        onValueChange={aoMudar}
        trackColor={{ true: cores.petroleo }}
        thumbColor={cores.branco}
        style={estilos.interruptor}
      />
    </View>
  );
}

export default function Ajustes() {
  const router = useRouter();
  const [chaves, setChaves] = useState<Chaves>({ guardiao: false, planoB: false, demo: false });
  const [rotaLigada, setRotaLigada] = useState(false);
  const [chaveiro, setChaveiro] = useState<ChaveiroDto | null | undefined>(undefined);
  const [msgChaveiro, setMsgChaveiro] = useState<string | undefined>();
  const [msgRota, setMsgRota] = useState<string | undefined>();
  const [msgDemo, setMsgDemo] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const aviso = useAvisoChaveiro((s) => s.mensagem);
  const acks = useRef(0);
  // Trava síncrona: dois toques antes de re-renderizar não simulam duas vezes.
  const ocupadoRef = useRef(false);

  const carregar = useCallback(() => {
    let vivo = true;
    (async () => {
      try {
        const s = sessaoRepo(await abrirBanco());
        const [g, p, d, c] = await Promise.all([s.get(CHAVE_GUARDIAO), s.get(CHAVE_PLANO_B), s.get(CHAVE_DEMO), s.get(CHAVE_CONSENTIMENTO)]);
        if (!vivo) return;
        setChaves({ guardiao: g === '1', planoB: p === '1', demo: d === '1' });
        setRotaLigada(c === 'sim');
      } catch {
        // sem banco: os interruptores ficam desligados
      }
    })();
    api.chaveiros
      .listar()
      .then((l) => {
        if (vivo) setChaveiro(escolher(l));
      })
      .catch(() => {
        if (vivo) setChaveiro((atual) => atual ?? null);
      });
    return () => {
      vivo = false;
    };
  }, []);
  useFocusEffect(carregar);

  async function gravar(chave: string, valor: boolean) {
    await sessaoRepo(await abrirBanco()).set(chave, valor ? '1' : '0');
  }

  async function mudarGuardiao(v: boolean) {
    setChaves((c) => ({ ...c, guardiao: v }));
    try {
      await gravar(CHAVE_GUARDIAO, v);
      if (v) await iniciarServicoGuardiao();
      else await pararServicoGuardiao();
    } catch {
      console.warn('ajustes: falha ao mudar o modo guardiao');
    }
  }

  async function mudarPlanoB(v: boolean) {
    setChaves((c) => ({ ...c, planoB: v }));
    await gravar(CHAVE_PLANO_B, v).catch(() => undefined);
  }

  async function mudarDemo(v: boolean) {
    setChaves((c) => ({ ...c, demo: v }));
    setMsgDemo(undefined);
    await gravar(CHAVE_DEMO, v).catch(() => undefined);
  }

  async function achar() {
    if (!chaveiro) return;
    setMsgChaveiro(undefined);
    try {
      await api.chaveiros.comando(chaveiro.deviceId, 'find');
      setMsgChaveiro(AVISO_ACHAR);
    } catch (e) {
      setMsgChaveiro(`⚠ ${mensagemDeErro(e)}`);
    }
  }

  function confirmarRevogacao() {
    Alert.alert('Desligar a rota?', 'O Ampara para de guardar por onde você anda e apaga o que ainda não foi enviado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desligar a rota',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setMsgRota(undefined);
            try {
              await revogarConsentimento();
              setMsgRota('Rota desligada.');
            } catch (e) {
              // a parada local acontece mesmo com erro na API
              setMsgRota(`Rota desligada neste aparelho. ⚠ ${mensagemDeErro(e)}`);
            }
            setRotaLigada(false);
          })();
        },
      },
    ]);
  }

  function confirmarSaida() {
    Alert.alert('Sair e apagar dados?', 'Os dados do Ampara saem deste aparelho. Para voltar, entre de novo com e-mail e senha.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair e apagar', style: 'destructive', onPress: () => void sair() },
    ]);
  }

  // Modo demonstração: tudo passa por handleEvent, no aparelho, sem internet.
  async function simular(eventos: EventoChaveiro[]): Promise<('nova' | 'repetida')[]> {
    const db = await abrirBanco();
    const ackLocal = () => {
      acks.current += 1;
    };
    const r: ('nova' | 'repetida')[] = [];
    for (const e of eventos) r.push(await handleEvent(e, { db, ackLocal }));
    return r;
  }

  async function executar(acao: () => Promise<string | undefined>) {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setMsgDemo(undefined);
    useAvisoChaveiro.getState().limpar();
    try {
      setMsgDemo(await acao());
    } catch {
      setMsgDemo('⚠ Não foi possível simular agora. Tente de novo.');
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }

  const simularAlerta = () =>
    executar(async () => {
      await simular([gerarEventoDemo('alert', DEVICE_DEMO)]);
      return 'Alerta simulado.';
    });

  const simularCancelamento = () =>
    executar(async () => {
      // cancela o alerta demo aberto mais recente (vale também depois de fechar o app)
      const aberto = (await ocorrenciaRepo(await abrirBanco()).listar()).find((o) => o.estado === 'Aberta' && o.id.startsWith(PREFIXO_DEMO));
      if (!aberto) return 'Nenhum alerta aberto para cancelar. Toque em "Simular alerta" antes.';
      await simular([{ ...gerarEventoDemo('cancel', DEVICE_DEMO), alertId: aberto.id.slice(PREFIXO_DEMO.length) }]);
      return 'Alerta cancelado.';
    });

  const simularTeste = () =>
    executar(async () => {
      await simular([gerarEventoDemo('test', DEVICE_DEMO)]);
      return undefined; // o aviso "Chaveiro funcionando" aparece abaixo
    });

  const simularBateria = () =>
    executar(async () => {
      await simular([gerarEventoDemo('low_battery', DEVICE_DEMO)]);
      return undefined;
    });

  const repetirCinco = () =>
    executar(async () => {
      const antes = acks.current;
      const e = gerarEventoDemo('alert', DEVICE_DEMO);
      const r = await simular([e, e, e, e, e]);
      const novos = r.filter((x) => x === 'nova').length;
      const confirmacoes = acks.current - antes;
      return `${novos} alerta novo e ${r.length - novos} repetidos ignorados. Confirmações ao chaveiro: ${confirmacoes}.`;
    });

  const status = chaveiro ? rotuloStatus(chaveiro, new Date()) : null;

  return (
    <ScrollView contentContainerStyle={estilos.tela}>

      <View style={estilos.caixa}>
        <Texto variante="titulo">Chaveiro</Texto>
        {chaveiro ? (
          <>
            <Texto>{chaveiro.deviceId}</Texto>
            {status ? <Texto>{status.texto}</Texto> : null}
            <Botao rotulo="Achar chaveiro" onPress={() => void achar()} />
          </>
        ) : chaveiro === null ? (
          <Texto>Nenhum chaveiro encontrado. Sem conexão ou ainda não pareado.</Texto>
        ) : (
          <Texto>Carregando...</Texto>
        )}
        {msgChaveiro ? <Texto accessibilityLiveRegion="polite">{msgChaveiro}</Texto> : null}
      </View>

      <View style={estilos.caixa}>
        <Texto variante="titulo">Rota</Texto>
        {rotaLigada ? (
          <>
            <Texto>A sua rota é guardada por 7 dias, só para você.</Texto>
            <Botao rotulo="Desligar a rota e apagar o que foi guardado" variante="secundario" onPress={confirmarRevogacao} />
          </>
        ) : (
          <>
            <Texto>Rota desligada: nada é guardado.</Texto>
            <Botao rotulo="Ligar a rota" variante="secundario" onPress={() => router.push('/onboarding/consentimento' as never)} />
          </>
        )}
        {msgRota ? <Texto accessibilityLiveRegion="polite">{msgRota}</Texto> : null}
      </View>

      <View style={estilos.caixa}>
        <Texto variante="titulo">Alarme</Texto>
        <Interruptor
          rotulo="Sou guardião: receber alarmes"
          dica="Mantém um aviso fixo e toca o alarme quando alguém que você protege pedir ajuda."
          valor={chaves.guardiao}
          aoMudar={(v) => void mudarGuardiao(v)}
        />
        <Interruptor
          rotulo="Alarme sem tela cheia"
          dica="Use se o alarme em tela cheia não abrir: aparece como aviso no topo, com som e vibração."
          valor={chaves.planoB}
          aoMudar={(v) => void mudarPlanoB(v)}
        />
      </View>

      <View style={estilos.caixa}>
        <Texto variante="titulo">Modo demonstração</Texto>
        <Interruptor
          rotulo="Modo demonstração"
          dica="Simula o chaveiro neste aparelho, sem internet. Ninguém de verdade é avisado."
          valor={chaves.demo}
          aoMudar={(v) => void mudarDemo(v)}
        />
        {chaves.demo ? (
          <>
            <Botao rotulo="Simular alerta" onPress={() => void simularAlerta()} desabilitado={ocupado} />
            <Botao rotulo="Simular cancelamento" variante="secundario" onPress={() => void simularCancelamento()} desabilitado={ocupado} />
            <Botao rotulo="Simular teste" variante="secundario" onPress={() => void simularTeste()} desabilitado={ocupado} />
            <Botao rotulo="Simular bateria baixa" variante="secundario" onPress={() => void simularBateria()} desabilitado={ocupado} />
            <Botao rotulo="Repetir o mesmo alerta 5 vezes" variante="secundario" onPress={() => void repetirCinco()} desabilitado={ocupado} />
            {msgDemo ? <Texto accessibilityLiveRegion="polite">{msgDemo}</Texto> : null}
            {aviso ? (
              <Texto accessibilityRole="alert" accessibilityLiveRegion="assertive">
                {aviso}
              </Texto>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={estilos.caixa}>
        <Texto variante="titulo">Conta</Texto>
        <Botao rotulo="Sair e apagar dados deste aparelho" variante="perigo" onPress={confirmarSaida} />
      </View>

      <View style={estilos.caixa}>
        <Texto variante="titulo">Sobre</Texto>
        <Texto>{FRASE_SOBRE}</Texto>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  caixa: { gap: espacos.p, borderWidth: 2, borderColor: cores.petroleo, borderRadius: 12, padding: espacos.m, backgroundColor: cores.branco },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.m, minHeight: tamanhos.alvoMin },
  linhaTexto: { flex: 1, gap: 2 },
  interruptor: { minWidth: tamanhos.alvoMin, minHeight: tamanhos.alvoMin },
});
