import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { extrairImeiDeCodigo, imeiValido } from '../../imei/luhn';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { espacos } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, type InstanciaCampo } from '../../ui/Campo';
import { LeitorCodigo } from '../../ui/LeitorCodigo';
import { TelaPasso } from '../../ui/TelaPasso';
import { Texto } from '../../ui/Texto';

const MSG_IMEI_INVALIDO = 'O IMEI tem 15 números e passa numa conferência. Confira os dígitos.';

// Máscara visual 2-6-6-1 (49-015420-323751-8); o valor guardado e enviado é só dígitos.
function mascarar(d: string): string {
  return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 14), d.slice(14, 15)].filter(Boolean).join('-');
}

export default function OnboardingImei() {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [imei, setImei] = useState('');
  const [modoNumero, setModoNumero] = useState<'escolha' | 'camera' | 'digitar'>('escolha');
  const [cameraNegada, setCameraNegada] = useState(false);
  const [avisoLeitura, setAvisoLeitura] = useState<string | undefined>();
  const [avisoDiscador, setAvisoDiscador] = useState<string | undefined>();
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const refModelo = useRef<InstanciaCampo>(null);

  const valido = imeiValido(imei);
  const erroImei = imei.length >= 15 && !valido ? MSG_IMEI_INVALIDO : undefined;
  const podeConfirmar = valido && marca.trim().length > 0 && modelo.trim().length > 0;

  function aoLer(valor: string) {
    const lido = extrairImeiDeCodigo(valor);
    if (lido) {
      // Mostra o número lido no campo para o cidadão conferir.
      setImei(lido);
      setAvisoLeitura(undefined);
      setModoNumero('digitar');
    } else {
      setAvisoLeitura('Esse código não parece um IMEI. Tente outro código da caixa ou digite o número.');
      setModoNumero('escolha');
    }
  }

  function aoNegar() {
    setCameraNegada(true);
    setModoNumero('digitar');
  }

  async function confirmar() {
    if (!podeConfirmar) return;
    setErro(undefined);
    setEnviando(true);
    try {
      await api.aparelhos.criar({ imei, marca: marca.trim(), modelo: modelo.trim() });
      setImei(''); // depois de enviado o IMEI não fica em estado nem em tela
      await concluirPassoSeguro('imei');
      router.replace('/');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const titulos = ['Por que pedimos o IMEI', 'Onde achar o IMEI', 'Informe o número', 'Marca e modelo'];
  const voltar = passo > 0 ? <Botao rotulo="Voltar" variante="texto" onPress={() => setPasso(passo - 1)} /> : null;

  let acao;
  if (passo === 0) {
    acao = <Botao rotulo="Começar" onPress={() => setPasso(1)} />;
  } else if (passo === 1) {
    acao = (
      <>
        <Botao rotulo="Continuar" onPress={() => setPasso(2)} />
        {voltar}
      </>
    );
  } else if (passo === 2) {
    acao = (
      <>
        <Botao rotulo="Continuar" desabilitado={!valido} onPress={() => setPasso(3)} />
        {voltar}
      </>
    );
  } else {
    acao = (
      <>
        <Botao rotulo="Confirmar" desabilitado={!podeConfirmar} carregando={enviando} onPress={confirmar} />
        {voltar}
      </>
    );
  }

  return (
    <TelaPasso passo="imei" icone="info" titulo={titulos[passo]} acao={acao}>
      {passo === 0 ? (
        <>
          <Texto variante="corpoForte">Na hora do susto você não vai lembrar do IMEI. Guarde agora.</Texto>
          <Texto>O boletim de ocorrência eletrônico de roubo ou furto de celular exige esse número.</Texto>
        </>
      ) : null}

      {passo === 1 ? (
        <>
          <Texto>1. Na caixa ou na nota fiscal do celular (código de barras).</Texto>
          <Texto>2. Discando *#06# no celular.</Texto>
          <Texto>3. Em Ajustes, Sobre o telefone.</Texto>
          <Texto>4. Pela câmera, lendo o código de barras da caixa.</Texto>
          <Texto variante="legenda">Se o celular tem dois chips, use só o IMEI 1.</Texto>
          <Botao
            rotulo="Abrir o discador"
            variante="secundario"
            onPress={() => {
              setAvisoDiscador(undefined);
              Linking.openURL('tel:*%2306%23').catch(() =>
                setAvisoDiscador('Não consegui abrir o discador. Disque *#06# você mesmo.'),
              );
            }}
          />
          {avisoDiscador ? <Aviso mensagem={avisoDiscador} /> : null}
        </>
      ) : null}

      {passo === 2 ? (
        <>
          {cameraNegada ? <Texto accessibilityLiveRegion="polite">Sem a câmera, digite o número.</Texto> : null}
          {avisoLeitura ? <Aviso mensagem={avisoLeitura} /> : null}
          {modoNumero === 'escolha' ? (
            <View style={estilos.grupo}>
              <Botao rotulo="Ler pela câmera" variante="secundario" onPress={() => setModoNumero('camera')} />
              <Botao rotulo="Digitar o número" variante="secundario" onPress={() => { setAvisoLeitura(undefined); setModoNumero('digitar'); }} />
            </View>
          ) : null}
          {modoNumero === 'camera' ? (
            <>
              <LeitorCodigo tipos={['code128', 'code39']} aoLer={aoLer} aoNegar={aoNegar} />
              <Botao rotulo="Digitar o número" variante="secundario" onPress={() => { setAvisoLeitura(undefined); setModoNumero('digitar'); }} />
            </>
          ) : null}
          {modoNumero === 'digitar' ? (
            <Campo
              rotulo="IMEI"
              valor={mascarar(imei)}
              onChangeText={(t) => setImei(t.replace(/\D/g, '').slice(0, 15))}
              keyboardType="number-pad"
              autoComplete="off"
              autoCorrect={false}
              accessibilityHint="O IMEI tem 15 números"
              erro={erroImei}
            />
          ) : null}
          {modoNumero === 'digitar' && valido ? <Texto variante="legenda">Confira se o número é o do seu celular.</Texto> : null}
        </>
      ) : null}

      {passo === 3 ? (
        <>
          <Campo
            rotulo="Marca"
            valor={marca}
            onChangeText={setMarca}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => refModelo.current?.focus()}
            submitBehavior="submit"
          />
          <Campo
            entradaRef={refModelo}
            rotulo="Modelo"
            valor={modelo}
            onChangeText={setModelo}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={confirmar}
          />
          {erro ? <Aviso mensagem={erro} /> : null}
        </>
      ) : null}
    </TelaPasso>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacos.m },
});
