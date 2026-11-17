import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { ApiErro, MSG_PADRAO } from '../api/cliente';
import { criarConta, entrar, entrarComoEmergencia, limparMotivoSaida, useMotivoSaida } from '../auth/sessao';
import { abrirBanco } from '../db/db';
import { sessaoRepo } from '../db/repos';
import { cores, espacos, raios } from '../theme/tokens';
import { Aviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo, type InstanciaCampo } from '../ui/Campo';
import { Icone } from '../ui/Icone';
import { TelaPasso } from '../ui/TelaPasso';
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
  return MSG_PADRAO;
}

export default function Entrar() {
  const router = useRouter();
  const motivoSaida = useMotivoSaida();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [palavra, setPalavra] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [carregando, setCarregando] = useState(false);
  // Com o teclado aberto a barra de ação ocuparia metade do campo: só o botão primário fica.
  const [tecladoAberto, setTecladoAberto] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setTecladoAberto(true));
    const f = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTecladoAberto(false));
    return () => {
      a.remove();
      f.remove();
    };
  }, []);
  const refSenha = useRef<InstanciaCampo>(null);
  const refEmail = useRef<InstanciaCampo>(null);
  const refCodigo = useRef<InstanciaCampo>(null);
  const refPalavra = useRef<InstanciaCampo>(null);
  // Item 8: a sessão expirou com o papel de guardião ligado; o alarme só volta depois de entrar de novo.
  const [guardiaoSemSessao, setGuardiaoSemSessao] = useState(false);

  useEffect(() => {
    if (motivoSaida !== 'expirou') {
      setGuardiaoSemSessao(false);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const ativo = (await sessaoRepo(await abrirBanco()).get('guardiao_ativo')) === '1';
        if (vivo) setGuardiaoSemSessao(ativo);
      } catch {
        // sem banco: fica só a frase geral
      }
    })();
    return () => {
      vivo = false;
    };
  }, [motivoSaida]);

  function trocar(m: Modo) {
    setModo(m);
    setErro(undefined);
  }

  async function enviar() {
    setErro(undefined);
    limparMotivoSaida();
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

  const acao = (
    <>
      <Botao rotulo={rotuloEnviar} onPress={enviar} carregando={carregando} />
      {!tecladoAberto && modo !== 'entrar' ? <Botao rotulo="Já tenho conta" variante="texto" onPress={() => trocar('entrar')} /> : null}
      {!tecladoAberto && modo === 'entrar' ? <Botao rotulo="Criar conta" variante="texto" onPress={() => trocar('criar')} /> : null}
    </>
  );

  const proximoDoEmail = () => (modo === 'emergencia' ? refCodigo : refSenha).current?.focus();

  return (
    <TelaPasso titulo={TITULOS[modo]} acao={acao}>
      {modo === 'emergencia' ? (
        <>
          <Texto variante="corpoForte">Use os dados de emergência que você cadastrou.</Texto>
          <Texto>Nada fica salvo neste aparelho e a sessão dura 30 minutos.</Texto>
        </>
      ) : null}

      {motivoSaida === 'expirou' ? <Nota texto="Sua sessão terminou. Entre de novo." /> : null}
      {motivoSaida === 'expirou' && guardiaoSemSessao ? <Nota texto="Você é guardião: entre de novo para receber alarmes." /> : null}

      {modo === 'criar' ? (
        <Campo
          rotulo="Nome"
          valor={nome}
          onChangeText={setNome}
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => refEmail.current?.focus()}
          submitBehavior="submit"
        />
      ) : null}
      <Campo
        entradaRef={refEmail}
        rotulo="E-mail"
        valor={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={modo === 'emergencia' ? 'off' : 'email'}
        importantForAutofill={modo === 'emergencia' ? 'no' : 'auto'}
        returnKeyType="next"
        onSubmitEditing={proximoDoEmail}
        submitBehavior="submit"
      />
      {modo === 'emergencia' ? (
        <>
          <Campo
            entradaRef={refCodigo}
            rotulo="Código de emergência"
            valor={codigo}
            onChangeText={setCodigo}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="next"
            onSubmitEditing={() => refPalavra.current?.focus()}
            submitBehavior="submit"
          />
          <Campo
            entradaRef={refPalavra}
            rotulo="Palavra secreta"
            valor={palavra}
            onChangeText={setPalavra}
            secureTextEntry
            revelavel
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="done"
            onSubmitEditing={enviar}
          />
        </>
      ) : (
        <Campo
          entradaRef={refSenha}
          rotulo="Senha"
          valor={senha}
          onChangeText={setSenha}
          secureTextEntry
          revelavel
          autoCapitalize="none"
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={enviar}
        />
      )}

      {erro ? <Aviso mensagem={erro} /> : null}

      {modo !== 'emergencia' ? (
        <View style={estilos.outroAparelho}>
          <Icone nome="alerta" tamanho={24} cor={cores.areia} />
          <Texto variante="secao" style={estilos.sobrePetroleo}>
            Seu celular foi roubado?
          </Texto>
          <Texto style={estilos.sobrePetroleo}>Entre pelo aparelho de outra pessoa, com o seu código de emergência.</Texto>
          <Botao rotulo="Estou no aparelho de outra pessoa" variante="secundario" onPress={() => trocar('emergencia')} />
        </View>
      ) : null}
    </TelaPasso>
  );
}

// Aviso neutro (não é erro): ícone e texto, anunciado ao leitor de tela.
function Nota({ texto }: { texto: string }) {
  return (
    <View style={estilos.nota} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icone nome="info" tamanho={20} cor={cores.petroleo} />
      <Texto variante="legenda" style={estilos.textoNota}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.p,
    padding: espacos.pm,
    borderRadius: raios.m,
    backgroundColor: cores.areiaFunda,
  },
  textoNota: { flex: 1 },
  // Caminho da vítima depois do roubo: bloco próprio em petróleo, texto só em areia (8,5:1).
  outroAparelho: {
    gap: espacos.pm,
    marginTop: espacos.m,
    padding: espacos.m,
    borderRadius: raios.g,
    backgroundColor: cores.petroleo,
  },
  sobrePetroleo: { color: cores.areia },
});
