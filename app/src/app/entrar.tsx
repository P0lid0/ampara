import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ApiErro } from '../api/cliente';
import { criarConta, entrar, entrarComoEmergencia } from '../auth/sessao';
import { espacos } from '../theme/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Texto } from '../ui/Texto';

type Modo = 'entrar' | 'criar' | 'emergencia';

const TITULOS: Record<Modo, string> = {
  entrar: 'Entrar',
  criar: 'Criar conta',
  emergencia: 'Estou no aparelho de outra pessoa',
};

// Mensagem do modo emergência: não diferencia e-mail inexistente de dados errados.
function mensagemErro(e: unknown, modo: Modo): string {
  if (e instanceof ApiErro) {
    if (modo === 'emergencia') {
      if (e.status === 429) return 'Muitas tentativas erradas. Aguarde 15 minutos.';
      if (e.status === 401 || e.status === 404) return 'Dados incorretos.';
    }
    return e.detalheCidadao ?? e.message;
  }
  return 'Não foi possível concluir agora. Tente de novo.';
}

export default function Entrar() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [palavra, setPalavra] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [carregando, setCarregando] = useState(false);

  function trocar(m: Modo) {
    setModo(m);
    setErro(undefined);
  }

  async function enviar() {
    setErro(undefined);
    setCarregando(true);
    try {
      if (modo === 'entrar') await entrar(email.trim(), senha);
      else if (modo === 'criar') await criarConta(nome.trim(), email.trim(), senha);
      else await entrarComoEmergencia(email.trim(), codigo.trim(), palavra);
      router.replace(modo === 'emergencia' ? '/historico' : '/');
    } catch (e) {
      setErro(mensagemErro(e, modo));
    } finally {
      setCarregando(false);
    }
  }

  const rotuloEnviar = modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Entrar em modo emergência';

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Ampara', headerBackVisible: false }} />
      <Texto variante="titulo">{TITULOS[modo]}</Texto>
      {modo === 'emergencia' ? (
        <Texto>Use os dados de emergência que você cadastrou. Nada fica salvo neste aparelho e a sessão dura 30 minutos.</Texto>
      ) : null}

      {modo === 'criar' ? <Campo rotulo="Nome" valor={nome} onChangeText={setNome} autoComplete="name" /> : null}
      <Campo
        rotulo="E-mail"
        valor={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      {modo === 'emergencia' ? (
        <>
          <Campo rotulo="Código de emergência" valor={codigo} onChangeText={setCodigo} autoCapitalize="none" autoCorrect={false} />
          <Campo rotulo="Palavra secreta" valor={palavra} onChangeText={setPalavra} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        </>
      ) : (
        <Campo rotulo="Senha" valor={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" autoComplete="password" />
      )}

      {erro ? (
        <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">
          {`⚠ ${erro}`}
        </Texto>
      ) : null}

      <Botao rotulo={rotuloEnviar} onPress={enviar} carregando={carregando} />

      {modo !== 'entrar' ? <Botao rotulo="Já tenho conta" variante="secundario" onPress={() => trocar('entrar')} /> : null}
      {modo !== 'criar' ? <Botao rotulo="Criar conta" variante="secundario" onPress={() => trocar('criar')} /> : null}
      {modo !== 'emergencia' ? (
        <Botao rotulo="Estou no aparelho de outra pessoa" variante="secundario" onPress={() => trocar('emergencia')} />
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
