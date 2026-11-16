import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, type InstanciaCampo } from '../../ui/Campo';
import { TelaPasso } from '../../ui/TelaPasso';
import { Texto } from '../../ui/Texto';

// Tamanhos são regras do app (o contrato não fixa): código de 6 números, palavra de 4+ caracteres.
export const MSG_CODIGO = 'O código tem 6 números.';
export const MSG_CODIGO_DIFERENTE = 'Os dois códigos precisam ser iguais.';
export const MSG_PALAVRA_DIFERENTE = 'As duas palavras secretas precisam ser iguais.';
export const MSG_PALAVRA = 'A palavra secreta precisa de 4 caracteres ou mais.';

export default function OnboardingEmergencia() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [codigo2, setCodigo2] = useState('');
  const [palavra, setPalavra] = useState('');
  const [palavra2, setPalavra2] = useState('');
  const [erroCodigo, setErroCodigo] = useState<string | undefined>();
  const [erroPalavra, setErroPalavra] = useState<string | undefined>();
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const refPalavra2 = useRef<InstanciaCampo>(null);

  async function salvar() {
    setErro(undefined);
    const codigoOk = /^\d{6}$/.test(codigo);
    const palavraOk = palavra.trim().length >= 4;
    const codigoIgual = codigo === codigo2;
    const palavraIgual = palavra.trim() === palavra2.trim();
    setErroCodigo(!codigoOk ? MSG_CODIGO : codigoIgual ? undefined : MSG_CODIGO_DIFERENTE);
    setErroPalavra(!palavraOk ? MSG_PALAVRA : palavraIgual ? undefined : MSG_PALAVRA_DIFERENTE);
    if (!codigoOk || !palavraOk || !codigoIgual || !palavraIgual) return;
    setEnviando(true);
    try {
      await api.me.definirEmergencia({ codigo, palavraSecreta: palavra.trim() });
      setCodigo('');
      setCodigo2('');
      setPalavra('');
      setPalavra2('');
      await concluirPassoSeguro('emergencia');
      router.replace('/');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaPasso
      passo="emergencia"
      titulo="Seu código de emergência"
      acao={<Botao rotulo="Salvar" onPress={salvar} carregando={enviando} />}
    >
      <Texto variante="corpoForte">Com ele você usa o Ampara no aparelho de outra pessoa, se o seu for roubado.</Texto>
      <Texto>Crie um código de 6 números e uma palavra secreta. Digite cada um duas vezes.</Texto>
      <Texto>Anote os dois em um lugar seguro: o Ampara não mostra o código de novo.</Texto>
      <Campo
        rotulo="Código de emergência"
        valor={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        revelavel
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        erro={erroCodigo}
      />
      <Campo
        rotulo="Repita o código"
        valor={codigo2}
        onChangeText={(t) => setCodigo2(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        revelavel
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
      />
      <Campo
        rotulo="Palavra secreta"
        valor={palavra}
        onChangeText={setPalavra}
        secureTextEntry
        revelavel
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="next"
        onSubmitEditing={() => refPalavra2.current?.focus()}
        submitBehavior="submit"
        erro={erroPalavra}
      />
      <Campo
        entradaRef={refPalavra2}
        rotulo="Repita a palavra secreta"
        valor={palavra2}
        onChangeText={setPalavra2}
        secureTextEntry
        revelavel
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="done"
        onSubmitEditing={salvar}
      />
      {erro ? <Aviso mensagem={erro} /> : null}
    </TelaPasso>
  );
}
