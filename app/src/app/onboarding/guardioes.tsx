import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { ConviteDto, GuardiaoDto } from '../../api/tipos';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { bordas, cores, espacos, raios } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { TelaPasso } from '../../ui/TelaPasso';
import { Texto } from '../../ui/Texto';

const MAXIMO = 3;

/** Payload do QR do convite (contrato do plano 05). O código é o único dado do convite. */
export function payloadDoConvite(codigo: string): string {
  return `ampara://guardiao/aceitar?codigo=${codigo}`;
}

function restante(expiraEm: string, agora: number): number {
  return Math.max(0, Math.floor((Date.parse(expiraEm) - agora) / 1000));
}

/** mm:ss abaixo de 1 h; h:mm:ss a partir de 1 h (um convite de 24 h não pode ler "1439:52"). */
export function mmss(segundos: number): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
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

  const temGuardiao = guardioes.length > 0;
  const acao = (
    <>
      {temGuardiao || convite ? <Botao rotulo="Continuar" onPress={() => void seguir()} /> : null}
      <Botao
        rotulo={convite ? 'Gerar outro código' : 'Convidar'}
        variante={convite ? 'texto' : temGuardiao ? 'secundario' : 'primario'}
        desabilitado={cheio}
        carregando={ocupado}
        onPress={() => void convidar()}
      />
      {!temGuardiao && !convite ? <Botao rotulo="Fazer depois" variante="texto" onPress={() => void seguir()} /> : null}
    </>
  );

  return (
    <TelaPasso passo="guardioes" icone="link" titulo="Seus guardiões" acao={acao}>
      <Texto variante="corpoForte">Até 3 pessoas de confiança recebem o alerta se o seu celular for roubado.</Texto>
      <Texto>Para convidar, mostre o código ou o QR a quem você escolher. Pode fazer isso depois.</Texto>

      {temGuardiao ? (
        <View style={estilos.lista} accessibilityLabel="Guardiões, do primeiro a ser avisado ao último">
          {guardioes.map((g, i) => (
            <View key={g.guardiaoId} style={estilos.item}>
              <View style={estilos.nomeLinha}>
                <Texto variante="secao">{`${i + 1}. `}</Texto>
                <Texto variante="secao" style={estilos.nome}>
                  {g.nome}
                </Texto>
              </View>
              <View style={estilos.ordem}>
                <View style={estilos.metade}>
                  <Botao rotulo={`Subir ${g.nome}`} variante="secundario" desabilitado={i === 0} onPress={() => void mover(i, -1)} />
                </View>
                <View style={estilos.metade}>
                  <Botao
                    rotulo={`Descer ${g.nome}`}
                    variante="secundario"
                    desabilitado={i === guardioes.length - 1}
                    onPress={() => void mover(i, 1)}
                  />
                </View>
              </View>
            </View>
          ))}
          <Texto variante="legenda">O primeiro da lista é o primeiro a receber o alerta.</Texto>
        </View>
      ) : null}

      {cheio ? <Texto accessibilityLiveRegion="polite">Você já tem 3 guardiões.</Texto> : null}

      {convite ? (
        <View style={estilos.convite}>
          <Texto>Peça para a pessoa abrir o Ampara e digitar este código ou ler o QR:</Texto>
          <Texto variante="exibicao" style={estilos.codigo} accessibilityLabel={`Código ${convite.codigo.split('').join(' ')}`}>
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
          {vencido ? (
            <Aviso mensagem="Esse código venceu. Toque em Gerar outro código." />
          ) : (
            <Texto variante="corpoForte" accessibilityLiveRegion="polite">{`Vale por ${mmss(segundos)}`}</Texto>
          )}
          <Botao rotulo="Atualizar a lista" variante="texto" onPress={() => void carregar()} />
        </View>
      ) : null}

      {erro ? <Aviso mensagem={erro} /> : null}
    </TelaPasso>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacos.pm },
  item: {
    gap: espacos.pm,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    borderRadius: raios.m,
    padding: espacos.m,
    backgroundColor: cores.branco,
  },
  nomeLinha: { flexDirection: 'row', alignItems: 'baseline' },
  nome: { flex: 1 },
  ordem: { flexDirection: 'row', gap: espacos.p },
  metade: { flex: 1 },
  convite: {
    gap: espacos.m,
    alignItems: 'center',
    padding: espacos.m,
    borderRadius: raios.g,
    backgroundColor: cores.branco,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
  },
  codigo: { letterSpacing: 6, textAlign: 'center' },
  qr: { padding: espacos.m, backgroundColor: cores.branco, borderRadius: raios.m },
});
