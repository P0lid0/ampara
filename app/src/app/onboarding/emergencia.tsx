import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ApiErro, MSG_PADRAO } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';
import { concluirPasso } from '../../onboarding/passos';
import { espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { ProgressoPassos } from '../../ui/ProgressoPassos';
import { Texto } from '../../ui/Texto';

// Tamanhos são regras do app (o contrato não fixa): código de 6 números, palavra de 4+ caracteres.
export const MSG_CODIGO = 'O código tem 6 números.';
export const MSG_PALAVRA = 'A palavra secreta precisa de 4 caracteres ou mais.';

export default function OnboardingEmergencia() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [palavra, setPalavra] = useState('');
  const [erroCodigo, setErroCodigo] = useState<string | undefined>();
  const [erroPalavra, setErroPalavra] = useState<string | undefined>();
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setErro(undefined);
    const codigoOk = /^\d{6}$/.test(codigo);
    const palavraOk = palavra.trim().length >= 4;
    setErroCodigo(codigoOk ? undefined : MSG_CODIGO);
    setErroPalavra(palavraOk ? undefined : MSG_PALAVRA);
    if (!codigoOk || !palavraOk) return;
    setEnviando(true);
    try {
      await api.me.definirEmergencia({ codigo, palavraSecreta: palavra.trim() });
      setCodigo('');
      setPalavra('');
      try {
        await concluirPasso(await abrirBanco(), 'emergencia');
      } catch {
        // o servidor já guardou; a reconciliação (emergenciaConfigurada) marca o passo na próxima abertura
      }
      router.replace('/');
    } catch (e) {
      setErro(e instanceof ApiErro ? (e.detalheCidadao ?? e.message) : MSG_PADRAO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Código de emergência' }} />
      <ProgressoPassos passo="emergencia" />
      <Texto variante="titulo">Seu código de emergência</Texto>
      <Texto>
        Se o seu celular for roubado, você poderá usar o Ampara no aparelho de outra pessoa. Para isso, crie um código de 6 números e uma
        palavra secreta. Anote os dois em um lugar seguro: o Ampara não mostra o código de novo.
      </Texto>
      <Campo
        rotulo="Código de emergência"
        valor={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        erro={erroCodigo}
      />
      <Campo
        rotulo="Palavra secreta"
        valor={palavra}
        onChangeText={setPalavra}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        erro={erroPalavra}
      />
      {erro ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto> : null}
      <Botao rotulo="Salvar" onPress={salvar} carregando={enviando} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
