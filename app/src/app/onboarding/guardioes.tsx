import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { ConviteDto, GuardiaoDto } from '../../api/tipos';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { cores, espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { ProgressoPassos } from '../../ui/ProgressoPassos';
import { Texto } from '../../ui/Texto';

const MAXIMO = 3;

/** Payload do QR do convite (contrato do plano 05). O código é o único dado do convite. */
export function payloadDoConvite(codigo: string): string {
  return `ampara://guardiao/aceitar?codigo=${codigo}`;
}

function restante(expiraEm: string, agora: number): number {
  return Math.max(0, Math.floor((Date.parse(expiraEm) - agora) / 1000));
}

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function OnboardingGuardioes() {
  const router = useRouter();
  const [guardioes, setGuardioes] = useState<GuardiaoDto[]>([]);
  const [convite, setConvite] = useState<ConviteDto | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const lista = await api.guardioes.listar();
      setGuardioes([...lista].sort((a, b) => a.ordem - b.ordem));
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Contagem regressiva do convite: um tique por segundo enquanto houver convite válido.
  const validoAte = convite ? Date.parse(convite.expiraEm) : 0;
  useEffect(() => {
    if (!convite) return;
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [convite]);

  const cheio = guardioes.length >= MAXIMO;
  const segundos = convite ? restante(convite.expiraEm, agora) : 0;
  const vencido = convite !== null && (segundos === 0 || validoAte <= agora);

  async function convidar() {
    if (cheio) return;
    setErro(undefined);
    setOcupado(true);
    try {
      setConvite(await api.guardioes.criarConvite());
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta;
    if (destino < 0 || destino >= guardioes.length) return;
    const anterior = guardioes;
    const nova = [...guardioes];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setGuardioes(nova.map((g, i) => ({ ...g, ordem: i + 1 })));
    setErro(undefined);
    try {
      await api.guardioes.ordenar(nova.map((g) => g.guardiaoId));
    } catch (e) {
      setGuardioes(anterior);
      setErro(mensagemDeErro(e));
    }
  }

  async function seguir() {
    await concluirPassoSeguro('guardioes');
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Guardiões' }} />
      <ProgressoPassos passo="guardioes" />
      <Texto variante="titulo">Seus guardiões</Texto>
      <Texto>
        Guardiões são até 3 pessoas de confiança que recebem o alerta se o seu celular for roubado. Para convidar, mostre o código ou o QR a
        quem você escolher. Você pode fazer isso depois.
      </Texto>

      {guardioes.length > 0 ? (
        <View style={estilos.lista} accessibilityLabel="Guardiões, do primeiro a ser avisado ao último">
          {guardioes.map((g, i) => (
            <View key={g.guardiaoId} style={estilos.item}>
              <Texto style={estilos.nomeGuardiao}>{`${i + 1}. `}</Texto>
              <Texto style={estilos.nomeGuardiao}>{g.nome}</Texto>
              <View style={estilos.ordem}>
                <Botao rotulo={`Subir ${g.nome}`} variante="secundario" desabilitado={i === 0} onPress={() => void mover(i, -1)} />
                <Botao
                  rotulo={`Descer ${g.nome}`}
                  variante="secundario"
                  desabilitado={i === guardioes.length - 1}
                  onPress={() => void mover(i, 1)}
                />
              </View>
            </View>
          ))}
          <Texto variante="legenda">O primeiro da lista é o primeiro a receber o alerta.</Texto>
        </View>
      ) : null}

      {cheio ? <Texto accessibilityLiveRegion="polite">Você já tem 3 guardiões.</Texto> : null}
      <Botao rotulo="Convidar" desabilitado={cheio} carregando={ocupado} onPress={() => void convidar()} />

      {convite ? (
        <View style={estilos.convite}>
          <Texto>Peça para a pessoa abrir o Ampara e digitar este código ou ler o QR:</Texto>
          <Texto variante="titulo" style={estilos.codigo} accessibilityLabel={`Código ${convite.codigo.split('').join(' ')}`}>
            {convite.codigo}
          </Texto>
          <View
            testID="qr-convite"
            accessible
            accessibilityLabel={`QR do convite. Código ${convite.codigo}`}
            style={estilos.qr}
          >
            <QRCode value={payloadDoConvite(convite.codigo)} size={200} backgroundColor={cores.branco} color={cores.tinta} />
          </View>
          <Texto accessibilityLiveRegion="polite">
            {vencido ? '⚠ Esse código venceu. Toque em Convidar para gerar outro.' : `Vale por ${mmss(segundos)}`}
          </Texto>
          <Botao rotulo="Atualizar a lista" variante="secundario" onPress={() => void carregar()} />
        </View>
      ) : null}

      {erro ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto> : null}

      <Botao rotulo={guardioes.length > 0 ? 'Continuar' : 'Fazer depois'} variante={guardioes.length > 0 ? 'primario' : 'secundario'} onPress={() => void seguir()} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  lista: { gap: espacos.m },
  item: { gap: espacos.p, borderWidth: 2, borderColor: cores.petroleo, borderRadius: 12, padding: espacos.m, backgroundColor: cores.branco },
  nomeGuardiao: { fontSize: 20, lineHeight: 28 },
  ordem: { flexDirection: 'row', gap: espacos.p },
  convite: { gap: espacos.m, alignItems: 'center' },
  codigo: { fontSize: 40, lineHeight: 48, letterSpacing: 6 },
  qr: { padding: espacos.m, backgroundColor: cores.branco, borderRadius: 12 },
});
