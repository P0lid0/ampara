// Aba Ajustes: chaveiro, rota, alarme e guardiões, prevenção, "Sobre", demonstração (Avançado) e sair.
// Grupos numa superfície só, com título pequeno; o estado de cada interruptor vem escrito.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Grupo, TituloGrupo } from '../../ui/Grupo';
import { Icone, type NomeIcone } from '../../ui/Icone';
import { Interruptor } from '../../ui/Interruptor';
import { Texto } from '../../ui/Texto';

export const FRASE_SOBRE = 'O Ampara não bloqueia o seu celular nem as suas contas: ele avisa quem pode fazer isso.';
// SINTETICO: chaveiro de demonstração (contrato: chaveiro-ampara- + 6 hex).
export const DEVICE_DEMO = 'chaveiro-ampara-0de300';

const CHAVE_DEMO = 'demo';
const CHAVE_GUARDIAO = 'guardiao_ativo';
const CHAVE_CONSENTIMENTO = 'rota.consentimento';
const AVISO_ACHAR = 'O chaveiro vai piscar e tocar por 6 segundos.';

type Chaves = { guardiao: boolean; planoB: boolean; demo: boolean };

// Linha que leva a outra tela: ícone, texto e seta; a linha inteira é o alvo (>= 56 dp).
function LinhaNavega({ icone, rotulo, descricao, dica, aoTocar }: { icone: NomeIcone; rotulo: string; descricao?: string; dica?: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      android_ripple={{ color: cores.bordaSuave }}
      onPress={aoTocar}
      style={({ pressed }) => [estilos.navega, pressed && estilos.pressionada]}
    >
      <Icone nome={icone} tamanho={24} cor={cores.petroleo} />
      <View style={estilos.conteudo}>
        <Texto variante="corpoForte" style={estilos.rotuloNavega}>{rotulo}</Texto>
        {descricao ? <Texto variante="legenda" style={estilos.suave}>{descricao}</Texto> : null}
      </View>
      <View style={estilos.seta}>
        <Icone nome="voltar" tamanho={20} cor={cores.petroleo} />
      </View>
    </Pressable>
  );
}

function Linha({ icone, children }: { icone: NomeIcone; children: ReactNode }) {
  return (
    <View style={estilos.linha}>
      <View style={estilos.icone}>
        <Icone nome={icone} tamanho={24} cor={cores.petroleo} />
      </View>
      <View style={estilos.conteudo}>{children}</View>
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
  const [msgAlarme, setMsgAlarme] = useState<string | undefined>();
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
        setChaves({ guardiao: g !== '0', planoB: p === '1', demo: d === '1' });
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

  // Mostra o estado desejado, grava e, se algo falhar, volta ao estado real e avisa por escrito.
  async function gravarInterruptor(campo: keyof Chaves, chave: string, valor: boolean, depois?: () => Promise<unknown>) {
    const anterior = chaves[campo];
    setMsgAlarme(undefined);
    setChaves((c) => ({ ...c, [campo]: valor }));
    try {
      await gravar(chave, valor);
      await depois?.();
    } catch {
      setChaves((c) => ({ ...c, [campo]: anterior }));
      await gravar(chave, anterior).catch(() => undefined);
      setMsgAlarme(`Não foi possível ${valor ? 'ligar' : 'desligar'} esta opção. Ela continua ${anterior ? 'ligada' : 'desligada'}. Tente de novo.`);
    }
  }

  const mudarGuardiao = (v: boolean) => gravarInterruptor('guardiao', CHAVE_GUARDIAO, v, () => (v ? iniciarServicoGuardiao() : pararServicoGuardiao()));
  const mudarPlanoB = (v: boolean) => gravarInterruptor('planoB', CHAVE_PLANO_B, v);
  const mudarDemo = (v: boolean) => {
    setMsgDemo(undefined);
    return gravarInterruptor('demo', CHAVE_DEMO, v);
  };

  async function achar() {
    if (!chaveiro) return;
    setMsgChaveiro(undefined);
    try {
      await api.chaveiros.comando(chaveiro.deviceId, 'find');
      setMsgChaveiro(AVISO_ACHAR);
    } catch (e) {
      setMsgChaveiro(mensagemDeErro(e));
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
              setMsgRota(`Rota desligada neste aparelho. ${mensagemDeErro(e)}`);
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
      { text: 'Sair e apagar', style: 'destructive', onPress: () => void sair().catch(() => Alert.alert('Não foi possível sair', 'Tente de novo.')) },
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
      setMsgDemo('Não foi possível simular agora. Tente de novo.');
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
      <TituloGrupo>Seu chaveiro</TituloGrupo>
      <Grupo>
        <Linha icone="chaveiro">
          {chaveiro ? (
            <>
              <Texto variante="corpoForte">Chaveiro</Texto>
              {status ? <Texto>{status.texto}</Texto> : null}
              <Texto variante="legenda" style={estilos.suave}>{chaveiro.deviceId}</Texto>
              <Botao rotulo="Achar chaveiro" variante="secundario" onPress={() => void achar()} dica="Faz o chaveiro piscar e tocar" />
            </>
          ) : chaveiro === null ? (
            <>
              <Texto variante="corpoForte">Chaveiro</Texto>
              <Texto>Nenhum chaveiro encontrado. Sem conexão ou ainda não pareado.</Texto>
            </>
          ) : (
            <>
              <View style={estilos.esqueleto} />
              <Texto variante="legenda" style={estilos.suave}>Carregando...</Texto>
            </>
          )}
          {msgChaveiro ? <Texto accessibilityLiveRegion="polite">{msgChaveiro}</Texto> : null}
        </Linha>
      </Grupo>

      <TituloGrupo>Rota</TituloGrupo>
      <Grupo>
        <Linha icone="rota">
          {rotaLigada ? (
            <>
              <Texto variante="corpoForte">Rota ligada</Texto>
              <Texto>A sua rota é guardada por 7 dias, só para você.</Texto>
              <Botao rotulo="Desligar a rota e apagar o que foi guardado" variante="secundario" onPress={confirmarRevogacao} />
            </>
          ) : (
            <>
              <Texto variante="corpoForte">Rota desligada</Texto>
              <Texto>Nada é guardado sobre por onde você anda.</Texto>
              <Botao rotulo="Ligar a rota" variante="secundario" onPress={() => router.push('/onboarding/consentimento' as never)} />
            </>
          )}
          {msgRota ? <Texto accessibilityLiveRegion="polite">{msgRota}</Texto> : null}
        </Linha>
      </Grupo>

      <TituloGrupo>Alarme e guardiões</TituloGrupo>
      <Grupo>
        <LinhaNavega
          icone="link"
          rotulo="Tenho um código de convite"
          descricao="Para virar guardião de alguém que enviou um código"
          aoTocar={() => router.push('/guardiao/aceitar' as never)}
        />
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
      </Grupo>
      {msgAlarme ? <Aviso mensagem={msgAlarme} /> : null}

      <TituloGrupo>Prevenção</TituloGrupo>
      <Grupo>
        <LinhaNavega
          icone="ok"
          rotulo="Checklist de prevenção"
          descricao="Três cuidados simples para deixar um roubo menos grave."
          aoTocar={() => router.push('/onboarding/checklist' as never)}
        />
      </Grupo>

      <TituloGrupo>Sobre</TituloGrupo>
      <Grupo>
        <Linha icone="info">
          <Texto>{FRASE_SOBRE}</Texto>
        </Linha>
      </Grupo>

      <TituloGrupo>Avançado</TituloGrupo>
      <Grupo>
        <Interruptor
          rotulo="Modo demonstração"
          dica="Para ensaiar sem o chaveiro de verdade: este celular finge os alertas, sem internet. Ninguém é avisado."
          valor={chaves.demo}
          aoMudar={(v) => void mudarDemo(v)}
        />
        {chaves.demo ? (
          <View style={estilos.demo}>
            <Botao rotulo="Simular alerta" onPress={() => void simularAlerta()} desabilitado={ocupado} />
            <Botao rotulo="Simular cancelamento" variante="secundario" onPress={() => void simularCancelamento()} desabilitado={ocupado} />
            <Botao rotulo="Simular teste" variante="secundario" onPress={() => void simularTeste()} desabilitado={ocupado} />
            <Botao rotulo="Simular bateria baixa" variante="secundario" onPress={() => void simularBateria()} desabilitado={ocupado} />
            <Botao rotulo="Repetir o mesmo alerta 5 vezes" variante="secundario" onPress={() => void repetirCinco()} desabilitado={ocupado} dica="Mostra que um alerta repetido conta uma vez só" />
            {msgDemo ? <Texto accessibilityLiveRegion="polite">{msgDemo}</Texto> : null}
            {aviso ? (
              <Texto accessibilityRole="alert" accessibilityLiveRegion="assertive">
                {aviso}
              </Texto>
            ) : null}
          </View>
        ) : null}
      </Grupo>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sair e apagar dados deste aparelho"
        android_ripple={{ color: cores.bordaSuave }}
        onPress={confirmarSaida}
        style={({ pressed }) => [estilos.sair, pressed && estilos.pressionada]}
      >
        <Icone nome="alerta" tamanho={24} cor={cores.alarmeTexto} />
        <Texto variante="corpoForte" style={estilos.textoSair}>Sair e apagar dados deste aparelho</Texto>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, paddingBottom: espacos.gg, gap: espacos.m },
  linha: { flexDirection: 'row', gap: espacos.pm, padding: espacos.m, minHeight: tamanhos.alvoMin },
  icone: { width: 24, paddingTop: espacos.xs },
  conteudo: { flex: 1, gap: espacos.p },
  suave: { color: cores.textoSuave },
  esqueleto: { height: 20, width: '60%', borderRadius: raios.p, backgroundColor: cores.areiaFunda },
  navega: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm, padding: espacos.m, minHeight: tamanhos.alvoAcao, minWidth: tamanhos.alvoMin },
  rotuloNavega: { color: cores.petroleo },
  seta: { transform: [{ rotate: '180deg' }] },
  pressionada: { backgroundColor: cores.areiaFunda },
  demo: { gap: espacos.pm, padding: espacos.m, paddingTop: 0 },
  sair: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm, minHeight: tamanhos.alvoAcao, minWidth: tamanhos.alvoMin, paddingHorizontal: espacos.m, borderRadius: raios.m },
  textoSair: { flex: 1, color: cores.alarmeTexto },
});
