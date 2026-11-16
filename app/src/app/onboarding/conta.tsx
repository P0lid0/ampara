import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { mensagemDeErro } from '../../api/cliente';
import { criarConta } from '../../auth/sessao';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, type InstanciaCampo } from '../../ui/Campo';
import { TelaPasso } from '../../ui/TelaPasso';
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
  const refEmail = useRef<InstanciaCampo>(null);
  const refSenha = useRef<InstanciaCampo>(null);

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
    <TelaPasso
      passo="conta"
      titulo="Crie sua conta"
      acao={<Botao rotulo="Criar conta" onPress={enviar} carregando={enviando} />}
    >
      <Texto>Com a conta, seus dados ficam guardados e você acessa de outro aparelho.</Texto>
      <Campo
        rotulo="Nome"
        valor={nome}
        onChangeText={setNome}
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => refEmail.current?.focus()}
        submitBehavior="submit"
      />
      <Campo
        entradaRef={refEmail}
        rotulo="E-mail"
        valor={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => refSenha.current?.focus()}
        submitBehavior="submit"
      />
      <Campo
        entradaRef={refSenha}
        rotulo="Senha"
        valor={senha}
        onChangeText={setSenha}
        secureTextEntry
        revelavel
        autoCapitalize="none"
        autoComplete="new-password"
        erro={erroSenha}
        returnKeyType="done"
        onSubmitEditing={enviar}
      />
      {erro ? <Aviso mensagem={erro} /> : null}
    </TelaPasso>
  );
}
