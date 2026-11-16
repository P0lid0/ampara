import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { ChaveiroDto } from '../api/tipos';
import { deveAvisarBateria, escolher, rotuloStatus } from '../chaveiro/status';
import { cores, espacos, raios, tamanhos } from '../theme/tokens';
import { Botao } from './Botao';
import { EstadoBadge } from './EstadoBadge';
import { Icone } from './Icone';
import { Texto } from './Texto';

export const INTERVALO_STATUS_MS = 30_000;

export type CartaoChaveiroProps = {
  /** Qual chaveiro mostrar; sem isso, o primeiro da lista. */
  deviceId?: string;
  /** Esconde o código técnico do aparelho (na tela Início a pessoa não precisa dele). */
  ocultarCodigo?: boolean;
};

const AVISO_ACHAR = 'O chaveiro vai piscar e tocar por 6 segundos.';

// Status por polling (lacuna L10): lista a cada 30 s e manda um ping ao abrir para o chaveiro responder logo.
// O aviso de bateria baixa fica aqui no cartão; a notificação local entra com o canal da Task 10.
export function CartaoChaveiro({ deviceId, ocultarCodigo }: CartaoChaveiroProps) {
  const [lista, setLista] = useState<ChaveiroDto[] | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [erro, setErro] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | undefined>();
  const [comoTestar, setComoTestar] = useState(false);
  const [anunciarBateria, setAnunciarBateria] = useState(false);
  const pingado = useRef(false);
  const ultimoAvisoBateria = useRef<Date | null>(null);
  const ativo = useRef(true);

  const carregar = useCallback(async () => {
    try {
      const nova = await api.chaveiros.listar();
      if (!ativo.current) return;
      const t = new Date();
      setAgora(t);
      setLista(nova);
      setErro(undefined);
      const c = escolher(nova, deviceId);
      if (!c) return;
      if (!pingado.current) {
        pingado.current = true;
        // Ping é de melhor esforço: se falhar, o polling de 30 s continua mostrando o estado real.
        api.chaveiros.comando(c.deviceId, 'ping').catch(() => undefined);
      }
      if (deveAvisarBateria(c, ultimoAvisoBateria.current, t)) {
        ultimoAvisoBateria.current = t;
        setAnunciarBateria(true);
      }
    } catch (e) {
      if (!ativo.current) return;
      // O relógio anda mesmo sem rede: dados velhos viram "Sem conexão" em vez de ficarem "Conectado".
      setAgora(new Date());
      setErro(mensagemDeErro(e));
    }
  }, [deviceId]);

  useEffect(() => {
    ativo.current = true;
    void carregar();
    const t = setInterval(() => void carregar(), INTERVALO_STATUS_MS);
    return () => {
      ativo.current = false;
      clearInterval(t);
    };
  }, [carregar]);

  const chaveiro = lista ? escolher(lista, deviceId) : null;
  const r = rotuloStatus(chaveiro, agora);

  async function achar() {
    if (!chaveiro) return;
    setErro(undefined);
    setAviso(undefined);
    try {
      await api.chaveiros.comando(chaveiro.deviceId, 'find');
      setAviso(AVISO_ACHAR);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const carregando = lista === null && !erro;
  return (
    <View style={estilos.heroi} accessibilityLabel="Cartão do chaveiro">
      <View style={estilos.titulo}>
        <Icone nome="chaveiro" tamanho={28} cor={cores.areia} />
        <Texto variante="secao" style={estilos.areia}>
          Seu chaveiro
        </Texto>
      </View>
      {carregando ? (
        <Texto style={estilos.areia} accessibilityLiveRegion="polite">
          Conferindo o chaveiro...
        </Texto>
      ) : (
        <>
          {chaveiro || erro ? <EstadoBadge estado={r.estado} /> : null}
          <Texto style={estilos.areia} accessibilityLiveRegion="polite">
            {r.texto}
          </Texto>
        </>
      )}
      {chaveiro && !ocultarCodigo ? (
        <Texto variante="legenda" style={estilos.areia}>
          {chaveiro.deviceId}
        </Texto>
      ) : null}
      {r.bateriaBaixa ? (
        <View style={estilos.aviso} accessibilityRole="alert" accessibilityLiveRegion={anunciarBateria ? 'assertive' : 'polite'}>
          <Icone nome="alerta" tamanho={20} cor={cores.alarmeTexto} />
          <Texto style={estilos.textoAviso}>Troque a pilha do chaveiro em breve.</Texto>
        </View>
      ) : null}
      {chaveiro ? <Botao rotulo="Achar meu chaveiro" onPress={() => void achar()} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Como testar"
        accessibilityState={{ expanded: comoTestar }}
        onPress={() => setComoTestar((v) => !v)}
        style={estilos.link}
      >
        <Texto variante="rotulo" style={estilos.linkTexto}>
          Como testar
        </Texto>
      </Pressable>
      {comoTestar ? (
        <Texto style={estilos.areia}>
          Para testar, segure o botão do chaveiro por 3 segundos sem alerta ativo. O app recebe um aviso de teste e ninguém é acionado.
        </Texto>
      ) : null}
      {aviso ? (
        <Texto style={estilos.areia} accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      ) : null}
      {erro ? (
        <View style={estilos.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icone nome="alerta" tamanho={20} cor={cores.alarmeTexto} />
          <Texto style={estilos.textoAviso}>{erro}</Texto>
        </View>
      ) : null}
    </View>
  );
}

// Bloco herói (MOBILE-DESIGN.md 8.2): superfície petróleo, raio g, padding g; tudo em areia sobre petróleo.
const estilos = StyleSheet.create({
  heroi: { gap: espacos.pm, borderRadius: raios.g, padding: espacos.g, backgroundColor: cores.petroleo },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm },
  areia: { color: cores.areia },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.p,
    borderRadius: raios.m,
    padding: espacos.pm,
    backgroundColor: cores.alarmeSuave,
  },
  textoAviso: { flex: 1, color: cores.alarmeTexto },
  link: { minHeight: tamanhos.alvoMin, minWidth: tamanhos.alvoMin, justifyContent: 'center', alignSelf: 'flex-start' },
  linkTexto: { color: cores.areia, textDecorationLine: 'underline' },
});
