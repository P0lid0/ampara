import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { deviceIdValido, ESPERA_PAREAMENTO_MS, INTERVALO_PAREAMENTO_MS } from '../../chaveiro/pareamento';
import { rotuloStatus } from '../../chaveiro/status';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CartaoChaveiro } from '../../ui/CartaoChaveiro';
import { LeitorCodigo } from '../../ui/LeitorCodigo';
import { TelaPasso } from '../../ui/TelaPasso';
import { Texto } from '../../ui/Texto';

const MSG_INVALIDO = 'O código do chaveiro não parece certo. Ele começa com "chaveiro-" e não tem espaços.';
const MSG_NAO_OUVI = 'Ainda não ouvi o chaveiro. Confira se ele está ligado.';
const MSG_SEM_CAMERA = 'Sem a câmera, digite o código.';

type Modo = 'escolha' | 'camera' | 'digitar';
type Fase = 'entrada' | 'esperando' | 'pareado' | 'naoOuvi';

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function OnboardingChaveiro() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('escolha');
  const [fase, setFase] = useState<Fase>('entrada');
  const [codigo, setCodigo] = useState('');
  const [pareado, setPareado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | undefined>();
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  // Espera o chaveiro aparecer conectado na lista; passado o prazo, deixa seguir mesmo assim.
  async function esperar(id: string) {
    setFase('esperando');
    const fim = Date.now() + ESPERA_PAREAMENTO_MS;
    while (ativo.current) {
      try {
        const c = (await api.chaveiros.listar()).find((x) => x.deviceId === id);
        if (c && rotuloStatus(c, new Date()).estado === 'online') {
          if (ativo.current) {
            setPareado(id);
            setFase('pareado');
          }
          return;
        }
      } catch {
        // rede instável: tenta de novo até o prazo
      }
      if (Date.now() >= fim) break;
      await dormir(INTERVALO_PAREAMENTO_MS);
    }
    if (ativo.current) {
      setPareado(id);
      setFase('naoOuvi');
    }
  }

  async function parear(bruto: string) {
    const id = bruto.trim();
    setErro(undefined);
    setAviso(undefined);
    if (!deviceIdValido(id)) {
      setErro(MSG_INVALIDO);
      return;
    }
    setCodigo(id);
    setFase('esperando');
    try {
      await api.chaveiros.criar(id);
    } catch (e) {
      if (!ativo.current) return;
      setFase('entrada');
      setErro(mensagemDeErro(e));
      return;
    }
    await esperar(id);
  }

  function aoLer(valor: string) {
    setModo('digitar');
    void parear(valor);
  }

  function aoNegar() {
    setModo('digitar');
    setAviso(MSG_SEM_CAMERA);
  }

  async function seguir() {
    await concluirPassoSeguro('chaveiro');
    router.replace('/');
  }

  const entrada = fase === 'entrada';
  const erroNoCampo = erro === MSG_INVALIDO && modo === 'digitar';

  const fazerDepois = <Botao rotulo="Fazer depois" variante="texto" onPress={() => void seguir()} />;
  let acao;
  if (!entrada) {
    acao = <Botao rotulo="Continuar" desabilitado={fase === 'esperando'} onPress={() => void seguir()} />;
  } else if (modo === 'escolha') {
    acao = (
      <>
        <Botao rotulo="Ler o QR" onPress={() => { setErro(undefined); setAviso(undefined); setModo('camera'); }} />
        {fazerDepois}
      </>
    );
  } else if (modo === 'camera') {
    acao = (
      <>
        <Botao rotulo="Digitar o código" variante="secundario" onPress={() => setModo('digitar')} />
        {fazerDepois}
      </>
    );
  } else {
    acao = (
      <>
        <Botao rotulo="Parear" onPress={() => void parear(codigo)} />
        {fazerDepois}
      </>
    );
  }

  return (
    <TelaPasso passo="chaveiro" titulo="Seu chaveiro" acao={acao}>
      <Texto variante="corpoForte">O chaveiro é um botão que você leva com você.</Texto>
      <Texto>Um clique dispara o alerta aos seus guardiões. Leia o QR dele ou digite o código para parear. Pode fazer isso depois.</Texto>

      {entrada && modo === 'escolha' ? (
        <Botao rotulo="Digitar o código" variante="secundario" onPress={() => { setErro(undefined); setModo('digitar'); }} />
      ) : null}

      {entrada && modo === 'camera' ? <LeitorCodigo tipos={['qr']} aoLer={aoLer} aoNegar={aoNegar} /> : null}

      {entrada && modo === 'digitar' ? (
        <Campo
          rotulo="Código do chaveiro"
          valor={codigo}
          onChangeText={setCodigo}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={() => void parear(codigo)}
          erro={erroNoCampo ? erro : undefined}
        />
      ) : null}

      {aviso && entrada ? <Texto accessibilityLiveRegion="polite">{aviso}</Texto> : null}
      {erro && !erroNoCampo ? <Aviso mensagem={erro} /> : null}

      {fase === 'esperando' ? <Texto accessibilityLiveRegion="polite">Procurando o chaveiro...</Texto> : null}
      {fase === 'naoOuvi' ? (
        <>
          <Texto accessibilityLiveRegion="polite">{MSG_NAO_OUVI}</Texto>
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void esperar(pareado ?? codigo)} />
        </>
      ) : null}
      {pareado && (fase === 'pareado' || fase === 'naoOuvi') ? <CartaoChaveiro deviceId={pareado} /> : null}
    </TelaPasso>
  );
}
