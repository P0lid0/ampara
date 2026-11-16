import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { ContaCatalogo } from '../../api/tipos';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { bordas, cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Icone } from '../../ui/Icone';
import { TelaPasso } from '../../ui/TelaPasso';
import { Texto } from '../../ui/Texto';

/** "2026-11-12" ou "2026-11-12T00:00:00Z" -> "12/11/2026" (sem passar por Date: não há fuso a errar). */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const TIPO_TEXTO: Record<ContaCatalogo['tipo'], string> = { banco: 'Banco', operadora: 'Operadora' };

/** O catálogo real traz telefone null na maioria das contas: diz isso em vez de mostrar "null". */
function linhaTelefone(t: string | null): string {
  return t && t.trim() ? `Telefone: ${t.trim()}` : 'Telefone não informado; use o link';
}

export default function OnboardingContas() {
  const router = useRouter();
  const [lista, setLista] = useState<ContaCatalogo[] | null>(null);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const vinculados = useRef(new Set<string>()); // já enviados com sucesso: uma nova tentativa não repete
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(undefined);
    try {
      setLista(await api.contas.catalogo());
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  async function seguir() {
    await concluirPassoSeguro('contas');
    router.replace('/');
  }

  async function continuar() {
    setErro(undefined);
    setEnviando(true);
    try {
      for (const c of lista ?? []) {
        if (!marcados.has(c.id) || vinculados.current.has(c.id)) continue;
        await api.contas.vincular(c.id);
        vinculados.current.add(c.id);
      }
      await seguir();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const acao = (
    <>
      {lista !== null ? <Botao rotulo="Continuar" onPress={continuar} carregando={enviando} /> : null}
      {lista === null && erro ? <Botao rotulo="Tentar de novo" onPress={() => void carregar()} /> : null}
      <Botao rotulo="Fazer depois" variante="texto" desabilitado={enviando} onPress={() => void seguir()} />
    </>
  );

  return (
    <TelaPasso passo="contas" titulo="Seus bancos e sua operadora" acao={acao}>
      <Texto>Marque onde você tem conta e qual é a sua operadora.</Texto>
      <Texto>Se o celular for roubado, você vê aqui o telefone e o link para bloquear cada um. Pode fazer isso depois.</Texto>

      {lista === null && !erro ? <Texto accessibilityLiveRegion="polite">Carregando...</Texto> : null}

      {(lista ?? []).map((c) => {
        const marcado = marcados.has(c.id);
        return (
          <Pressable
            key={c.id}
            accessibilityRole="checkbox"
            accessibilityLabel={[
              `${c.nome}, ${TIPO_TEXTO[c.tipo]}`,
              linhaTelefone(c.telefone),
              `Link: ${c.link}`,
              ...(c.conferidoEm ? [`Conferido em ${dataBr(c.conferidoEm)}`] : []),
            ].join('. ')}
            accessibilityState={{ checked: marcado }}
            onPress={() => alternar(c.id)}
            android_ripple={{ color: cores.areiaFunda }}
            style={[estilos.cartao, marcado && estilos.cartaoMarcado]}
          >
            <View style={estilos.linha}>
              <View style={[estilos.caixa, marcado && estilos.caixaMarcada]}>
                {marcado ? <Icone nome="ok" tamanho={20} cor={cores.areia} /> : null}
              </View>
              <View style={estilos.texto}>
                <Texto variante="secao" accessibilityRole="text">
                  {c.nome}
                </Texto>
                <Texto variante="legenda">{TIPO_TEXTO[c.tipo]}</Texto>
                <Texto variante="legenda">{linhaTelefone(c.telefone)}</Texto>
                <Texto variante="legenda">{`Link: ${c.link}`}</Texto>
                {c.conferidoEm ? <Texto variante="legenda">{`Conferido em ${dataBr(c.conferidoEm)}`}</Texto> : null}
              </View>
            </View>
          </Pressable>
        );
      })}

      {erro ? <Aviso mensagem={erro} /> : null}
    </TelaPasso>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    borderRadius: raios.m,
    padding: espacos.m,
    backgroundColor: cores.branco,
    overflow: 'hidden',
  },
  // Marcado: contorno petróleo de 2 px, mais o ✓ dentro da caixa (nunca só cor).
  cartaoMarcado: { borderWidth: bordas.padrao, borderColor: cores.petroleo },
  linha: { flexDirection: 'row', gap: espacos.m },
  caixa: {
    width: 28,
    height: 28,
    borderRadius: raios.p,
    borderWidth: bordas.padrao,
    borderColor: cores.petroleo,
    backgroundColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaMarcada: { backgroundColor: cores.petroleo },
  texto: { flex: 1, gap: espacos.xs },
});
