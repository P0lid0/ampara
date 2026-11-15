import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { ProgressoPassos } from '../../ui/ProgressoPassos';
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
        setEtapa('pronto');
      }
    } catch {
      setPausada(true);
      setEtapa('pronto');
    } finally {
      setOcupado(false);
    }
  }

  async function pedirSegundoPlano() {
    setOcupado(true);
    try {
      const r = await Location.requestBackgroundPermissionsAsync();
      if (!r.granted) setPausada(true);
    } catch {
      setPausada(true);
    } finally {
      setOcupado(false);
      setEtapa('pronto');
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Sua rota' }} />
      <ProgressoPassos passo="consentimento" />

      {etapa === 'consentimento' ? (
        <>
          <Texto variante="titulo">Guardar a sua rota</Texto>
          <Texto>
            Guardamos por 7 dias por onde você andou, só para você marcar onde foi o roubo e gerar o BO. Só você vê. Pode desligar quando
            quiser em Ajustes.
          </Texto>
          {erro ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto> : null}
          <Botao rotulo="Aceitar" onPress={() => decidir(true)} carregando={ocupado} />
          <Botao rotulo="Agora não" variante="secundario" onPress={() => decidir(false)} desabilitado={ocupado} />
        </>
      ) : null}

      {etapa === 'primeiroPlano' ? (
        <>
          <Texto variante="titulo">Localização com o app aberto</Texto>
          <Texto>Para guardar a rota, o Android vai perguntar se o Ampara pode usar a sua localização enquanto você usa o app.</Texto>
          <Botao rotulo="Permitir localização" onPress={pedirPrimeiroPlano} carregando={ocupado} />
        </>
      ) : null}

      {etapa === 'segundoPlano' ? (
        <>
          <Texto variante="titulo">Localização o tempo todo</Texto>
          <Texto>
            Para a rota continuar guardada com a tela apagada, escolha "Permitir o tempo todo" na próxima pergunta do Android. Sem isso a rota
            só é guardada com o app aberto.
          </Texto>
          <Botao rotulo="Permitir em segundo plano" onPress={pedirSegundoPlano} carregando={ocupado} />
        </>
      ) : null}

      {etapa === 'pronto' ? (
        <>
          <Texto variante="titulo">Tudo certo</Texto>
          {pausada ? (
            <>
              <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${MSG_ROTA_PAUSADA}`}</Texto>
              <Texto>Você pode permitir depois, em Ajustes do celular.</Texto>
            </>
          ) : (
            <Texto>A sua rota será guardada por 7 dias.</Texto>
          )}
          <Botao rotulo="Continuar" onPress={concluirEIr} />
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
