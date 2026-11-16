import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { ChaveiroDto } from '../api/tipos';
import { deveAvisarBateria, escolher, rotuloStatus } from '../chaveiro/status';
import { cores, espacos } from '../theme/tokens';
import { Botao } from './Botao';
import { EstadoBadge } from './EstadoBadge';
import { Texto } from './Texto';

export const INTERVALO_STATUS_MS = 30_000;

export type CartaoChaveiroProps = {
  /** Qual chaveiro mostrar; sem isso, o primeiro da lista. */
  deviceId?: string;
};

const AVISO_ACHAR = 'O chaveiro vai piscar e tocar por 6 segundos.';

// Status por polling (lacuna L10): lista a cada 30 s e manda um ping ao abrir para o chaveiro responder logo.
// O aviso de bateria baixa fica aqui no cartão; a notificação local entra com o canal da Task 10.
export function CartaoChaveiro({ deviceId }: CartaoChaveiroProps) {
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

  return (
    <View style={estilos.cartao} accessibilityLabel="Cartão do chaveiro">
      <EstadoBadge estado={r.estado} />
      <Texto accessibilityLiveRegion="polite">{r.texto}</Texto>
      {chaveiro ? <Texto variante="legenda">{chaveiro.deviceId}</Texto> : null}
      {r.bateriaBaixa ? (
        <Texto accessibilityRole="alert" accessibilityLiveRegion={anunciarBateria ? 'assertive' : 'polite'}>
          ⚠ Troque a pilha do chaveiro em breve.
        </Texto>
      ) : null}
      {chaveiro ? <Botao rotulo="Achar meu chaveiro" onPress={() => void achar()} /> : null}
      <Botao rotulo="Como testar" variante="secundario" onPress={() => setComoTestar((v) => !v)} />
      {comoTestar ? (
        <Texto>
          Para testar, segure o botão do chaveiro por 3 segundos sem alerta ativo. O app recebe um aviso de teste e ninguém é acionado.
        </Texto>
      ) : null}
      {aviso ? <Texto accessibilityLiveRegion="polite">{aviso}</Texto> : null}
      {erro ? (
        <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">
          {`⚠ ${erro}`}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espacos.m, borderWidth: 2, borderColor: cores.petroleo, borderRadius: 12, padding: espacos.m, backgroundColor: cores.branco },
});
