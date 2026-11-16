// BO (P1): o app só monta o texto; quem registra é a própria pessoa, na Delegacia Eletrônica. O texto
// contém o IMEI: fica só em memória (estado desta tela), nunca no SQLite, no SecureStore nem em log.
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { BoDto, BoStatus, Recuperacao, RetornoDto } from '../api/tipos';
import { MSG_BO_NUMERO, rotuloBoStatus, rotuloRecuperacao, rotuloRetorno, TEXTO_ORIENTACAO, validarBoNumero } from '../prevencao/retorno';
import { formatarHora } from '../rota/linhaDoTempo';
import { cores, espacos, tamanhos } from '../theme/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Texto } from '../ui/Texto';

const ATUALIZA_RETORNO_MS = 60_000;
const OPCOES_BO: BoStatus[] = ['nao_registrado', 'registrado'];
const OPCOES_RECUPERACAO: Recuperacao[] = ['sem_noticia', 'localizado', 'recuperado'];

function Opcao({ rotulo, marcada, aoEscolher }: { rotulo: string; marcada: boolean; aoEscolher: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: marcada }}
      onPress={aoEscolher}
      style={estilos.consentimento}
    >
      <Texto style={estilos.marca}>{marcada ? '◉' : '○'}</Texto>
      <Texto style={estilos.consentimentoTexto}>{rotulo}</Texto>
    </Pressable>
  );
}

const CONSENTIMENTO = 'Autorizo enviar esta ocorrência, sem meus dados pessoais, à polícia';

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
  const [boNumero, setBoNumero] = useState('');
  const [boStatus, setBoStatus] = useState<BoStatus>('nao_registrado');
  const [recuperacao, setRecuperacao] = useState<Recuperacao>('sem_noticia');
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
      if (!montada.current) return;
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
      if (montada.current) setProtocolo(r.protocolo);
    } catch (e) {
      if (montada.current) setErroEnvio(mensagemDeErro(e));
    } finally {
      if (montada.current) setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Boletim de ocorrência' }} />
      <Texto variante="titulo">Boletim de ocorrência</Texto>
      <Texto>Copie o texto e registre o BO na Delegacia Eletrônica, em outro aparelho.</Texto>

      {erro ? (
        <>
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto>
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} />
        </>
      ) : null}
      {!bo && !erro ? <Texto accessibilityLiveRegion="polite">Preparando o texto...</Texto> : null}

      {bo ? (
        <>
          <View style={estilos.caixa}>
            <Texto selectable>{bo.texto}</Texto>
          </View>
          <Botao rotulo="Copiar texto" onPress={() => void copiar()} />
          {copiado ? <Texto accessibilityLiveRegion="polite">Texto copiado.</Texto> : null}
          <Botao
            rotulo="Abrir a Delegacia Eletrônica"
            variante="secundario"
            onPress={() => void abrir(bo.linkDelegaciaEletronica)}
          />

          <Texto variante="titulo" style={estilos.subtitulo}>
            Delegacia mais perto
          </Texto>
          <Texto>{bo.delegacia.nome}</Texto>
          <Texto>{bo.delegacia.endereco}</Texto>
          <Botao rotulo="Ver no mapa" variante="secundario" onPress={() => void abrir(urlMapa(bo.delegacia))} />

          <Texto variante="titulo" style={estilos.subtitulo}>
            Compartilhar com a polícia
          </Texto>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={CONSENTIMENTO}
            accessibilityState={{ checked: consentiu, disabled: Boolean(protocolo) }}
            disabled={Boolean(protocolo)}
            onPress={() => setConsentiu((v) => !v)}
            style={estilos.consentimento}
          >
            <Texto style={estilos.marca}>{consentiu ? '☑' : '☐'}</Texto>
            <Texto style={estilos.consentimentoTexto}>{CONSENTIMENTO}</Texto>
          </Pressable>
          {protocolo ? (
            <Texto accessibilityLiveRegion="polite">{`Protocolo ${protocolo}`}</Texto>
          ) : (
            <Botao rotulo="Enviar à polícia" carregando={enviando} desabilitado={!consentiu} onPress={() => void enviar()} />
          )}
          {erroEnvio ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erroEnvio}`}</Texto> : null}
          {aviso ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${aviso}`}</Texto> : null}

          <Texto variante="titulo" style={estilos.subtitulo}>
            Retorno da polícia
          </Texto>
          {ret === null ? (
            <Texto accessibilityLiveRegion="polite">Ainda não enviado à polícia.</Texto>
          ) : ret ? (
            <View accessibilityLiveRegion="polite" style={estilos.caixa}>
              <Texto>{`Retorno do protocolo ${ret.protocolo}`}</Texto>
              <Texto variante="titulo" style={estilos.subtitulo}>
                {rotuloRetorno(ret.status)}
              </Texto>
              <Texto>{ret.mensagem}</Texto>
              <Texto variante="legenda">{`Atualizado às ${formatarHora(ret.atualizadoEm)}`}</Texto>
            </View>
          ) : (
            <Texto>Consultando o retorno...</Texto>
          )}
          {erroRetorno ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erroRetorno}`}</Texto> : null}
          <Texto>{TEXTO_ORIENTACAO}</Texto>

          <Texto variante="titulo" style={estilos.subtitulo}>
            Acompanhamento
          </Texto>
          <Campo
            rotulo="Número do BO (opcional)"
            valor={boNumero}
            onChangeText={editar(setBoNumero)}
            autoCapitalize="characters"
            autoCorrect={false}
            erro={erroNumero}
          />
          {OPCOES_BO.map((o) => (
            <Opcao key={o} rotulo={rotuloBoStatus(o)} marcada={boStatus === o} aoEscolher={() => editar(setBoStatus)(o)} />
          ))}
          {OPCOES_RECUPERACAO.map((o) => (
            <Opcao key={o} rotulo={rotuloRecuperacao(o)} marcada={recuperacao === o} aoEscolher={() => editar(setRecuperacao)(o)} />
          ))}
          <Botao rotulo="Salvar acompanhamento" variante="secundario" carregando={salvando} onPress={() => void salvarAcompanhamento()} />
          {salvo ? <Texto accessibilityLiveRegion="polite">Salvo.</Texto> : null}
          {erroSalvar ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erroSalvar}`}</Texto> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  caixa: { padding: espacos.m, borderWidth: 2, borderColor: cores.petroleo, borderRadius: 12, backgroundColor: cores.branco },
  subtitulo: { fontSize: 20, lineHeight: 28 },
  consentimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.p,
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    paddingVertical: espacos.p,
  },
  marca: { fontSize: 28, lineHeight: 34 },
  consentimentoTexto: { flex: 1 },
});
