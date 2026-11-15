import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { mensagemDeErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import type { ContaCatalogo } from '../../api/tipos';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { cores, espacos, tamanhos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { ProgressoPassos } from '../../ui/ProgressoPassos';
import { Texto } from '../../ui/Texto';

/** "2026-11-12" ou "2026-11-12T00:00:00Z" -> "12/11/2026" (sem passar por Date: não há fuso a errar). */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const TIPO_TEXTO: Record<ContaCatalogo['tipo'], string> = { banco: 'Banco', operadora: 'Operadora' };

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

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Bancos e operadora' }} />
      <ProgressoPassos passo="contas" />
      <Texto variante="titulo">Seus bancos e sua operadora</Texto>
      <Texto>
        Marque onde você tem conta e qual é a sua operadora. Se o celular for roubado, quem te ajuda vê aqui o telefone e o link para bloquear
        cada um. Você pode fazer isso depois.
      </Texto>

      {lista === null && !erro ? <Texto accessibilityLiveRegion="polite">Carregando...</Texto> : null}

      {(lista ?? []).map((c) => {
        const marcado = marcados.has(c.id);
        return (
          <Pressable
            key={c.id}
            accessibilityRole="checkbox"
            accessibilityLabel={`${c.nome}, ${TIPO_TEXTO[c.tipo]}`}
            accessibilityState={{ checked: marcado }}
            onPress={() => alternar(c.id)}
            style={[estilos.cartao, marcado && estilos.cartaoMarcado]}
          >
            <View style={estilos.linha}>
              <Texto style={estilos.marca}>{marcado ? '☑' : '☐'}</Texto>
              <View style={estilos.texto}>
                <Texto variante="titulo" style={estilos.nome} accessibilityRole="text">
                  {c.nome}
                </Texto>
                <Texto variante="legenda">{TIPO_TEXTO[c.tipo]}</Texto>
                <Texto variante="legenda">{`Telefone: ${c.telefone}`}</Texto>
                <Texto variante="legenda">{`Link: ${c.link}`}</Texto>
                <Texto variante="legenda">{`Conferido em ${dataBr(c.conferidoEm)}`}</Texto>
              </View>
            </View>
          </Pressable>
        );
      })}

      {erro ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto> : null}
      {lista === null && erro ? <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} /> : null}

      {lista !== null ? <Botao rotulo="Continuar" onPress={continuar} carregando={enviando} /> : null}
      <Botao rotulo="Fazer depois" variante="secundario" desabilitado={enviando} onPress={() => void seguir()} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  cartao: {
    minHeight: tamanhos.alvoMin,
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    padding: espacos.m,
    backgroundColor: cores.branco,
  },
  cartaoMarcado: { borderWidth: 4 },
  linha: { flexDirection: 'row', gap: espacos.m },
  marca: { fontSize: 28, lineHeight: 32 },
  texto: { flex: 1, gap: 2 },
  nome: { fontSize: 20, lineHeight: 28 },
});
