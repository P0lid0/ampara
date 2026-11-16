// BO (P1): o app só monta o texto; quem registra é a própria pessoa, na Delegacia Eletrônica. O texto
// contém o IMEI: fica só em memória (estado desta tela), nunca no SQLite, no SecureStore nem em log.
// Tela de tarefa longa e decisão calma: seções em superfícies brancas, "Enviar à polícia" ancorado na base.
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { BoDto, BoStatus, Recuperacao, RetornoDto } from '../api/tipos';
import { acompanhamentoLembrado, lembrarAcompanhamento } from '../prevencao/acompanhamentoMemoria';
import { MSG_BO_NUMERO, rotuloBoStatus, rotuloRecuperacao, rotuloRetorno, TEXTO_ORIENTACAO, validarBoNumero } from '../prevencao/retorno';
import { formatarHora } from '../rota/linhaDoTempo';
import { bordas, cores, espacos, raios, tamanhos } from '../theme/tokens';
import { Aviso } from '../ui/Aviso';
import { BarraAcao } from '../ui/BarraAcao';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Icone } from '../ui/Icone';
import { SairEmergencia } from '../ui/SairEmergencia';
import { Texto } from '../ui/Texto';

const ATUALIZA_RETORNO_MS = 60_000;
const OPCOES_BO: BoStatus[] = ['nao_registrado', 'registrado'];
const OPCOES_RECUPERACAO: Recuperacao[] = ['sem_noticia', 'localizado', 'recuperado'];

const MARCA = 28;

/** Caixa de seleção: preenchida com "ok" quando marcada (a forma muda, não só a cor). */
function CaixaMarca({ marcada }: { marcada: boolean }) {
  return (
    <View style={[estilos.caixaMarca, marcada && estilos.caixaMarcada]}>
      {marcada ? <Icone nome="ok" tamanho={20} cor={cores.areia} /> : null}
    </View>
  );
}

/** Botão de opção: anel com miolo cheio quando marcado. */
function RadioMarca({ marcada }: { marcada: boolean }) {
  return <View style={estilos.radioMarca}>{marcada ? <View style={estilos.radioMiolo} /> : null}</View>;
}

/** Linha inteira tocável (48 dp): marca à esquerda, texto à direita; marcada ganha preenchimento e peso. */
function Opcao({ rotulo, marcada, aoEscolher }: { rotulo: string; marcada: boolean; aoEscolher: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: marcada }}
      onPress={aoEscolher}
      style={({ pressed }) => [estilos.opcao, marcada && estilos.opcaoMarcada, pressed && !marcada && estilos.pressionado]}
    >
      <RadioMarca marcada={marcada} />
      <Texto variante={marcada ? 'corpoForte' : 'corpo'} style={estilos.opcaoTexto}>
        {rotulo}
      </Texto>
    </Pressable>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.secao}>
      <Texto variante="secao">{titulo}</Texto>
      {children}
    </View>
  );
}

const CONSENTIMENTO = 'Autorizo enviar esta ocorrência, sem meus dados pessoais, à polícia';
const AVISO_SUBSTITUI = 'Salvar substitui o acompanhamento anterior. Se você já salvou um número de BO, digite de novo.';
const MOTIVO_ENVIO = 'Marque a autorização acima para poder enviar.';

/** geo:lat,lng?q=lat,lng(nome): o Android abre no app de mapa. O nome vai codificado. */
export function urlMapa(d: BoDto['delegacia']): string {
  return `geo:${d.lat},${d.lng}?q=${d.lat},${d.lng}(${encodeURIComponent(d.nome)})`;
}

export default function Bo() {
  const { ocorrenciaId: param } = useLocalSearchParams<{ ocorrenciaId?: string }>();
  const id = typeof param === 'string' ? param : '';
  const [bo, setBo] = useState<BoDto | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();
  const [consentiu, setConsentiu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState<string | undefined>();
  const [erroEnvio, setErroEnvio] = useState<string | undefined>();
  const montada = useRef(true);
  // Retorno da polícia: undefined = ainda não consultou; null = 404 (não enviado).
  const [ret, setRet] = useState<RetornoDto | null | undefined>();
  const [erroRetorno, setErroRetorno] = useState<string | undefined>();
  // Item 19: sem envio à polícia o servidor não devolve o acompanhamento; o último salvo nesta execução
  // do app (memória, por ocorrência) preenche o formulário para o próximo PUT não apagar o que já foi salvo.
  const [lembrado] = useState(() => acompanhamentoLembrado(id));
  const [boNumero, setBoNumero] = useState(lembrado?.boNumero ?? '');
  const [boStatus, setBoStatus] = useState<BoStatus>(lembrado?.boStatus ?? 'nao_registrado');
  const [recuperacao, setRecuperacao] = useState<Recuperacao>(lembrado?.recuperacao ?? 'sem_noticia');
  const [conhecido, setConhecido] = useState(Boolean(lembrado));
  const [erroNumero, setErroNumero] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | undefined>();
  const editou = useRef(false);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setErro(undefined);
    try {
      const r = await api.ocorrencias.bo(id);
      if (montada.current) setBo(r);
    } catch (e) {
      if (montada.current) setErro(mensagemDeErro(e));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarRetorno = useCallback(async () => {
    try {
      const r = await api.ocorrencias.retorno(id);
      if (!montada.current) return;
      setRet(r);
      setErroRetorno(undefined);
      setConhecido(true);
      if (!editou.current) {
        setBoNumero(r.boNumero ?? '');
        setBoStatus(r.boStatus);
        setRecuperacao(r.recuperacao);
      }
    } catch (e) {
      if (!montada.current) return;
      if (e instanceof ApiErro && e.status === 404) {
        setRet(null);
        setErroRetorno(undefined);
      } else {
        setErroRetorno('Não foi possível atualizar o retorno agora. Tentamos de novo em 1 minuto.');
      }
    }
  }, [id]);

  // Consulta ao abrir e a cada 60 s enquanto a tela está aberta; o cleanup para o timer ao sair.
  useEffect(() => {
    void carregarRetorno();
    const t = setInterval(() => void carregarRetorno(), ATUALIZA_RETORNO_MS);
    return () => clearInterval(t);
  }, [carregarRetorno]);

  async function salvarAcompanhamento() {
    setSalvo(false);
    setErroSalvar(undefined);
    if (!validarBoNumero(boNumero)) {
      setErroNumero(MSG_BO_NUMERO);
      return;
    }
    setErroNumero(undefined);
    setSalvando(true);
    try {
      await api.ocorrencias.acompanhamento(id, { ...(boNumero ? { boNumero } : {}), boStatus, recuperacao });
      lembrarAcompanhamento(id, { boNumero, boStatus, recuperacao });
      if (!montada.current) return;
      setConhecido(true);
      setSalvo(true);
      editou.current = false; // o próximo retorno é a verdade do servidor
      void carregarRetorno();
    } catch (e) {
      if (montada.current) setErroSalvar(mensagemDeErro(e));
    } finally {
      if (montada.current) setSalvando(false);
    }
  }

  function editar<T>(set: (v: T) => void) {
    return (v: T) => {
      editou.current = true;
      setSalvo(false);
      set(v);
    };
  }

  async function copiar() {
    if (!bo) return;
    setAviso(undefined);
    try {
      await Clipboard.setStringAsync(bo.texto);
      if (montada.current) setCopiado(true);
    } catch {
      if (montada.current) {
        setCopiado(false);
        setAviso('Não foi possível copiar. Selecione o texto e copie pelo menu.');
      }
    }
  }

  async function abrir(url: string) {
    setAviso(undefined);
    try {
      await Linking.openURL(url);
    } catch {
      if (montada.current) setAviso('Não foi possível abrir. Tente de novo.');
    }
  }

  async function enviar() {
    if (!consentiu || enviando) return;
    setErroEnvio(undefined);
    setEnviando(true);
    try {
      const r = await api.ocorrencias.compartilharPolicia(id);
      if (!montada.current) return;
      setProtocolo(r.protocolo);
      // Item 10: o retorno passa a existir agora; consulta já, sem esperar o próximo ciclo de 60 s.
      void carregarRetorno();
    } catch (e) {
      if (montada.current) setErroEnvio(mensagemDeErro(e));
    } finally {
      if (montada.current) setEnviando(false);
    }
  }

  return (
    <View style={estilos.fundo}>
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Boletim de ocorrência' }} />
        <SairEmergencia />
        <View style={estilos.titulos}>
          <Texto variante="titulo">Registre o seu boletim</Texto>
          <Texto>Copie o texto e registre o BO na Delegacia Eletrônica, em outro aparelho.</Texto>
        </View>

        {erro ? (
          <>
            <Aviso mensagem={erro} />
            <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} />
          </>
        ) : null}
        {!bo && !erro ? (
          <View style={estilos.carregando} accessibilityLiveRegion="polite">
            <ActivityIndicator color={cores.petroleo} />
            <Texto>Preparando o texto...</Texto>
          </View>
        ) : null}

        {bo ? (
          <>
            <Secao titulo="Texto do boletim">
              <View style={estilos.texto}>
                <Texto selectable>{bo.texto}</Texto>
              </View>
              <Botao rotulo="Copiar texto" onPress={() => void copiar()} />
              {copiado ? (
                <View style={estilos.confirmacao} accessibilityLiveRegion="polite">
                  <Icone nome="ok" tamanho={20} cor={cores.petroleo} />
                  <Texto variante="corpoForte">Texto copiado.</Texto>
                </View>
              ) : null}
              <Botao
                rotulo="Abrir a Delegacia Eletrônica"
                variante="secundario"
                onPress={() => void abrir(bo.linkDelegaciaEletronica)}
              />
              {aviso ? <Aviso mensagem={aviso} /> : null}
            </Secao>

            <Secao titulo="Delegacia mais perto">
              <View style={estilos.delegacia}>
                <Texto variante="corpoForte">{bo.delegacia.nome}</Texto>
                <Texto>{bo.delegacia.endereco}</Texto>
              </View>
              <Botao rotulo="Ver no mapa" variante="secundario" onPress={() => void abrir(urlMapa(bo.delegacia))} />
            </Secao>

            <Secao titulo="Compartilhar com a polícia">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={CONSENTIMENTO}
                accessibilityState={{ checked: consentiu, disabled: Boolean(protocolo) }}
                disabled={Boolean(protocolo)}
                onPress={() => setConsentiu((v) => !v)}
                style={({ pressed }) => [estilos.opcao, consentiu && estilos.opcaoMarcada, pressed && !consentiu && estilos.pressionado]}
              >
                <CaixaMarca marcada={consentiu} />
                <Texto variante={consentiu ? 'corpoForte' : 'corpo'} style={estilos.opcaoTexto}>
                  {CONSENTIMENTO}
                </Texto>
              </Pressable>
              {protocolo ? (
                <View style={estilos.confirmacao} accessibilityLiveRegion="polite">
                  <Icone nome="ok" tamanho={20} cor={cores.petroleo} />
                  <Texto variante="corpoForte">{`Protocolo ${protocolo}`}</Texto>
                </View>
              ) : null}
            </Secao>

            <Secao titulo="Retorno da polícia">
              {ret === null && !protocolo ? (
                <View style={estilos.linhaInfo} accessibilityLiveRegion="polite">
                  <Icone nome="relogio" tamanho={20} cor={cores.petroleo} />
                  <Texto style={estilos.opcaoTexto}>Ainda não enviado à polícia.</Texto>
                </View>
              ) : ret ? (
                <View accessibilityLiveRegion="polite" style={estilos.retorno}>
                  <Texto variante="legenda" style={estilos.suave}>{`Retorno do protocolo ${ret.protocolo}`}</Texto>
                  <Texto variante="secao">{rotuloRetorno(ret.status)}</Texto>
                  <Texto>{ret.mensagem}</Texto>
                  <Texto variante="legenda" style={estilos.suave}>{`Atualizado às ${formatarHora(ret.atualizadoEm)}`}</Texto>
                </View>
              ) : (
                <Texto style={estilos.suave}>Consultando o retorno...</Texto>
              )}
              {erroRetorno ? <Aviso mensagem={erroRetorno} /> : null}
              <Texto variante="legenda" style={estilos.suave}>
                {TEXTO_ORIENTACAO}
              </Texto>
            </Secao>

            <Secao titulo="Acompanhamento">
              {!conhecido ? <Texto variante="legenda" style={estilos.suave}>{AVISO_SUBSTITUI}</Texto> : null}
              <Campo
                rotulo="Número do BO (opcional)"
                valor={boNumero}
                onChangeText={editar(setBoNumero)}
                autoCapitalize="characters"
                autoCorrect={false}
                erro={erroNumero}
              />
              <View accessibilityRole="radiogroup" accessibilityLabel="Situação do BO" style={estilos.grupo}>
                <Texto variante="rotulo">Situação do BO</Texto>
                {OPCOES_BO.map((o) => (
                  <Opcao key={o} rotulo={rotuloBoStatus(o)} marcada={boStatus === o} aoEscolher={() => editar(setBoStatus)(o)} />
                ))}
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Situação do celular" style={estilos.grupo}>
                <Texto variante="rotulo">Situação do celular</Texto>
                {OPCOES_RECUPERACAO.map((o) => (
                  <Opcao key={o} rotulo={rotuloRecuperacao(o)} marcada={recuperacao === o} aoEscolher={() => editar(setRecuperacao)(o)} />
                ))}
              </View>
              <Botao rotulo="Salvar acompanhamento" variante="secundario" carregando={salvando} onPress={() => void salvarAcompanhamento()} />
              {salvo ? (
                <View style={estilos.confirmacao} accessibilityLiveRegion="polite">
                  <Icone nome="ok" tamanho={20} cor={cores.petroleo} />
                  <Texto variante="corpoForte">Salvo.</Texto>
                </View>
              ) : null}
              {erroSalvar ? <Aviso mensagem={erroSalvar} /> : null}
            </Secao>
          </>
        ) : null}
      </ScrollView>

      {bo && !protocolo ? (
        <BarraAcao>
          {erroEnvio ? <Aviso mensagem={erroEnvio} /> : null}
          {!consentiu ? (
            <Texto variante="legenda" style={estilos.suave}>
              {MOTIVO_ENVIO}
            </Texto>
          ) : null}
          <Botao rotulo="Enviar à polícia" carregando={enviando} desabilitado={!consentiu} onPress={() => void enviar()} />
        </BarraAcao>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.areia },
  rolagem: { flex: 1 },
  tela: { padding: espacos.m, gap: espacos.m, paddingBottom: espacos.g },
  titulos: { gap: espacos.p },
  carregando: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm },
  secao: {
    gap: espacos.pm,
    padding: espacos.m,
    borderRadius: raios.m,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
  },
  texto: { padding: espacos.m, borderRadius: raios.p, backgroundColor: cores.areia },
  delegacia: { gap: espacos.xs },
  suave: { color: cores.textoSuave },
  confirmacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.p,
    padding: espacos.pm,
    borderRadius: raios.m,
    backgroundColor: cores.esmeraldaSuave,
  },
  linhaInfo: { flexDirection: 'row', alignItems: 'center', gap: espacos.p, minHeight: tamanhos.alvoMin },
  retorno: { gap: espacos.xs, padding: espacos.m, borderRadius: raios.m, backgroundColor: cores.areia },
  grupo: { gap: espacos.xs },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.pm,
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    paddingVertical: espacos.p,
    paddingHorizontal: espacos.pm,
    borderRadius: raios.m,
  },
  opcaoMarcada: { backgroundColor: cores.esmeraldaSuave },
  pressionado: { backgroundColor: cores.areiaFunda },
  opcaoTexto: { flex: 1 },
  caixaMarca: {
    width: MARCA,
    height: MARCA,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raios.p,
    borderWidth: bordas.padrao,
    borderColor: cores.petroleo,
    backgroundColor: cores.branco,
  },
  caixaMarcada: { backgroundColor: cores.petroleo },
  radioMarca: {
    width: MARCA,
    height: MARCA,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raios.pilula,
    borderWidth: bordas.padrao,
    borderColor: cores.petroleo,
    backgroundColor: cores.branco,
  },
  radioMiolo: { width: 14, height: 14, borderRadius: raios.pilula, backgroundColor: cores.petroleo },
});
