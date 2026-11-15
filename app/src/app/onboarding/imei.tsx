import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { ApiErro, MSG_PADRAO } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';
import { extrairImeiDeCodigo, imeiValido } from '../../imei/luhn';
import { concluirPasso } from '../../onboarding/passos';
import { espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { LeitorCodigo } from '../../ui/LeitorCodigo';
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
      try {
        await concluirPasso(await abrirBanco(), 'imei');
      } catch {
        // a reconciliação (GET /aparelhos) marca o passo na próxima abertura
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
      <Stack.Screen options={{ title: 'IMEI do celular' }} />
      <Texto variante="legenda">{`Passo ${passo + 1} de 4`}</Texto>

      {passo === 0 ? (
        <>
          <Texto variante="titulo">Por que pedimos o IMEI</Texto>
          <Texto>
            O boletim de ocorrência eletrônico de roubo ou furto de celular exige o IMEI. Na hora do susto você não vai lembrar dele,
            então guarde agora.
          </Texto>
          <Botao rotulo="Começar" onPress={() => setPasso(1)} />
        </>
      ) : null}

      {passo === 1 ? (
        <>
          <Texto variante="titulo">Onde achar o IMEI</Texto>
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
          {avisoDiscador ? <Texto accessibilityLiveRegion="polite">{`⚠ ${avisoDiscador}`}</Texto> : null}
          <Botao rotulo="Continuar" onPress={() => setPasso(2)} />
          <Botao rotulo="Voltar" variante="secundario" onPress={() => setPasso(0)} />
        </>
      ) : null}

      {passo === 2 ? (
        <>
          <Texto variante="titulo">Informe o número</Texto>
          {cameraNegada ? <Texto accessibilityLiveRegion="polite">Sem a câmera, digite o número.</Texto> : null}
          {avisoLeitura ? <Texto accessibilityLiveRegion="polite">{`⚠ ${avisoLeitura}`}</Texto> : null}
          {modoNumero === 'escolha' ? (
            <View style={estilos.grupo}>
              <Botao rotulo="Ler pela câmera" onPress={() => setModoNumero('camera')} />
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
          <Botao rotulo="Continuar" desabilitado={!valido} onPress={() => setPasso(3)} />
          <Botao rotulo="Voltar" variante="secundario" onPress={() => setPasso(1)} />
        </>
      ) : null}

      {passo === 3 ? (
        <>
          <Texto variante="titulo">Marca e modelo</Texto>
          <Campo rotulo="Marca" valor={marca} onChangeText={setMarca} autoCapitalize="words" />
          <Campo rotulo="Modelo" valor={modelo} onChangeText={setModelo} autoCapitalize="words" />
          {erro ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto> : null}
          <Botao rotulo="Confirmar" desabilitado={!podeConfirmar} carregando={enviando} onPress={confirmar} />
          <Botao rotulo="Voltar" variante="secundario" onPress={() => setPasso(2)} />
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  grupo: { gap: espacos.m },
});
