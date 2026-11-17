import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { iniciarRota } from '../../rota/tarefa';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { TelaPasso } from '../../ui/TelaPasso';
import { Texto } from '../../ui/Texto';

export const MSG_ROTA_PAUSADA = 'Rota pausada: falta a permissão de localização.';

type Etapa = 'consentimento' | 'primeiroPlano' | 'segundoPlano' | 'pronto';

export default function OnboardingConsentimento() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>('consentimento');
  const [pausada, setPausada] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function concluirEIr() {
    await concluirPassoSeguro('consentimento');
    router.replace('/');
  }

  async function decidir(aceito: boolean) {
    setErro(undefined);
    setOcupado(true);
    try {
      await api.me.consentimentoRota(aceito);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setOcupado(false);
      return;
    }
    setOcupado(false);
    if (aceito) setEtapa('primeiroPlano');
    else await concluirEIr(); // recusar é uma escolha válida: o passo conta como concluído e nada é pedido
  }

  async function pedirPrimeiroPlano() {
    setOcupado(true);
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.granted) {
        setEtapa('segundoPlano');
      } else {
        setPausada(true);
        await ligarRota(); // grava o consentimento no aparelho; sem permissão a tarefa não liga
        setEtapa('pronto');
      }
    } catch {
      setPausada(true);
      await ligarRota();
      setEtapa('pronto');
    } finally {
      setOcupado(false);
    }
  }

  // Liga a tarefa da rota; falha ao ligar vira "Rota pausada" (Início e Ajustes mostram o estado depois).
  async function ligarRota() {
    try {
      await iniciarRota();
    } catch {
      setPausada(true);
    }
  }

  async function pedirSegundoPlano() {
    setOcupado(true);
    let fundo = false;
    try {
      fundo = (await Location.requestBackgroundPermissionsAsync()).granted;
    } catch {
      fundo = false;
    }
    // Com a permissão de primeiro plano a tarefa já liga (serviço em primeiro plano); liga antes de sair do app.
    await ligarRota();
    if (!fundo) {
      setPausada(true);
      // Android 11+ só concede "o tempo todo" nas configurações do app.
      try {
        await Linking.openSettings();
      } catch {
        // sem configurações abertas: o aviso abaixo orienta
      }
    }
    setOcupado(false);
    setEtapa('pronto');
  }

  const TITULOS: Record<Etapa, string> = {
    consentimento: 'Guardar a sua rota',
    primeiroPlano: 'Localização com o app aberto',
    segundoPlano: 'Localização o tempo todo',
    pronto: 'Tudo certo',
  };

  const acao =
    etapa === 'consentimento' ? (
      <>
        <Botao rotulo="Aceitar" onPress={() => decidir(true)} carregando={ocupado} />
        <Botao rotulo="Agora não" variante="texto" onPress={() => decidir(false)} desabilitado={ocupado} />
      </>
    ) : etapa === 'primeiroPlano' ? (
      <Botao rotulo="Permitir localização" onPress={pedirPrimeiroPlano} carregando={ocupado} />
    ) : etapa === 'segundoPlano' ? (
      <Botao rotulo="Permitir em segundo plano" onPress={pedirSegundoPlano} carregando={ocupado} />
    ) : (
      <Botao rotulo="Continuar" onPress={concluirEIr} />
    );

  return (
    <TelaPasso passo="consentimento" icone="rota" titulo={TITULOS[etapa]} acao={acao}>
      {etapa === 'consentimento' ? (
        <>
          <Texto variante="corpoForte">Só você vê a sua rota.</Texto>
          <Texto>Guardamos por 7 dias por onde você andou, para você marcar onde foi o roubo e gerar o BO.</Texto>
          <Texto>Você pode desligar quando quiser em Ajustes.</Texto>
          {erro ? <Aviso mensagem={erro} /> : null}
        </>
      ) : null}

      {etapa === 'primeiroPlano' ? (
        <Texto>Para guardar a rota, o Android vai perguntar se o Ampara pode usar a sua localização enquanto você usa o app.</Texto>
      ) : null}

      {etapa === 'segundoPlano' ? (
        <>
          <Texto>Para a rota continuar guardada com a tela apagada, escolha "Permitir o tempo todo" na próxima pergunta do Android.</Texto>
          <Texto>Sem isso a rota só é guardada com o app aberto.</Texto>
        </>
      ) : null}

      {etapa === 'pronto' ? (
        pausada ? (
          <>
            <Aviso mensagem={MSG_ROTA_PAUSADA} />
            <Texto>Você pode permitir depois, em Ajustes do celular.</Texto>
          </>
        ) : (
          <Texto>A sua rota será guardada por 7 dias.</Texto>
        )
      ) : null}
    </TelaPasso>
  );
}
