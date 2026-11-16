import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ApiErro, MSG_PADRAO } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { abrirBanco } from '../../db/db';
import { sessaoRepo } from '../../db/repos';
import { espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { LeitorCodigo } from '../../ui/LeitorCodigo';
import { Texto } from '../../ui/Texto';

/** Tira espaços e hífens, põe em maiúsculas; só vale com exatamente 6 letras/números. */
export function normalizarCodigoConvite(entrada: string): string | null {
  const c = entrada.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

const MSG_TAMANHO = 'O código tem 6 letras ou números.';
const MSG_QR_ESTRANHO = 'Esse QR não é de um convite do Ampara. Peça outro ou digite o código.';
const POR_STATUS: Record<number, string> = {
  404: 'Código inválido. Confira com quem te convidou.',
  410: 'Esse código venceu. Peça outro para quem te convidou.',
  409: 'Essa pessoa já tem 3 guardiões.',
};

// A API preenche detalheCidadao com a frase padrão quando o servidor não manda; aí vale a frase do status.
function mensagemDoAceite(e: unknown): string {
  if (!(e instanceof ApiErro)) return MSG_PADRAO;
  const detalhe = e.detalheCidadao && e.detalheCidadao !== MSG_PADRAO ? e.detalheCidadao : undefined;
  return detalhe ?? POR_STATUS[e.status] ?? MSG_PADRAO;
}

/** Do QR lido: o payload ampara://guardiao/aceitar?codigo=XXXXXX ou o próprio código. */
function codigoDoQr(valor: string): string | null {
  const m = /[?&]codigo=([^&#]*)/.exec(valor);
  try {
    return normalizarCodigoConvite(m ? decodeURIComponent(m[1]) : valor);
  } catch {
    return null; // %-escape malformado vindo de um QR qualquer
  }
}

export default function AceitarConvite() {
  const router = useRouter();
  const { codigo: deepLink } = useLocalSearchParams<{ codigo?: string }>();
  const [texto, setTexto] = useState(() => (typeof deepLink === 'string' ? (normalizarCodigoConvite(deepLink) ?? deepLink) : ''));
  const [modo, setModo] = useState<'campo' | 'camera'>('campo');
  const [cameraNegada, setCameraNegada] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  function aoLer(valor: string) {
    const c = codigoDoQr(valor);
    if (c) {
      setTexto(c);
      setAviso(undefined);
    } else {
      setAviso(MSG_QR_ESTRANHO);
    }
    setModo('campo');
  }

  function aoNegar() {
    setCameraNegada(true);
    setModo('campo');
  }

  async function aceitar() {
    setErro(undefined);
    const codigo = normalizarCodigoConvite(texto);
    if (!codigo) {
      setErro(MSG_TAMANHO);
      return;
    }
    setEnviando(true);
    try {
      await api.guardioes.aceitar(codigo);
    } catch (e) {
      setErro(mensagemDoAceite(e));
      setEnviando(false);
      return;
    }
    try {
      await sessaoRepo(await abrirBanco()).set('guardiao_ativo', '1');
    } catch {
      // o convite já foi aceito no servidor; sem o SQLite o app descobre o papel na próxima abertura
    }
    setEnviando(false);
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Aceitar convite' }} />
      <Texto variante="titulo">Ser guardião de alguém</Texto>
      <Texto>
        Quem te convidou mostra um código de 6 letras ou números, ou um QR. Digite o código ou leia o QR com a câmera.
      </Texto>

      {cameraNegada ? <Texto accessibilityLiveRegion="polite">Sem a câmera, digite o código.</Texto> : null}
      {aviso ? <Texto accessibilityLiveRegion="polite">{`⚠ ${aviso}`}</Texto> : null}

      {modo === 'camera' ? (
        <>
          <LeitorCodigo tipos={['qr']} aoLer={aoLer} aoNegar={aoNegar} />
          <Botao rotulo="Digitar o código" variante="secundario" onPress={() => setModo('campo')} />
        </>
      ) : (
        <>
          <Campo
            rotulo="Código do convite"
            valor={texto}
            onChangeText={(t) => {
              setTexto(t.toUpperCase());
              setErro(undefined);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={12}
            erro={erro}
          />
          <Botao rotulo="Ler o QR" variante="secundario" onPress={() => { setAviso(undefined); setModo('camera'); }} />
          <Botao rotulo="Aceitar convite" carregando={enviando} onPress={() => void aceitar()} />
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
