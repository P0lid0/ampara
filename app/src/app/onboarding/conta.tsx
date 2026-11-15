import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { criarConta } from '../../auth/sessao';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { ProgressoPassos } from '../../ui/ProgressoPassos';
import { Texto } from '../../ui/Texto';

export const MSG_SENHA_CURTA = 'Use pelo menos 8 caracteres.';

export default function OnboardingConta() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState<string | undefined>();
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(undefined);
    if (senha.length < 8) {
      setErroSenha(MSG_SENHA_CURTA);
      return;
    }
    setErroSenha(undefined);
    setEnviando(true);
    try {
      await criarConta(nome.trim(), email.trim(), senha);
      await concluirPassoSeguro('conta');
      router.replace('/');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Sua conta' }} />
      <ProgressoPassos passo="conta" />
      <Texto variante="titulo">Crie sua conta</Texto>
      <Campo rotulo="Nome" valor={nome} onChangeText={setNome} autoComplete="name" />
      <Campo rotulo="E-mail" valor={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <Campo rotulo="Senha" valor={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" autoComplete="new-password" erro={erroSenha} />
      {erro ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto> : null}
      <Botao rotulo="Criar conta" onPress={enviar} carregando={enviando} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
