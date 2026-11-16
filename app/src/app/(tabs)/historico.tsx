// Aba Histórico: ocorrências do dono do aparelho, da mais nova à mais antiga. O estado vem sempre em
// texto (Aberta/Cancelada/Encerrada) além do ícone. No modo emergência (aparelho de outra pessoa) a
// API só devolve as do dono e cada linha leva a "Marcar onde foi (rota)".
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api/endpoints';
import { mensagemDeErro } from '../../api/cliente';
import { useSessao } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { rotuloEstado } from '../../guardiao/eventos';
import { dataCurta } from '../../guardiao/formatoData';
import { horaLocal } from '../../guardiao/notificacao';
import { cores, espacos, tamanhos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { EstadoBadge, type Estado } from '../../ui/EstadoBadge';
import { SairEmergencia } from '../../ui/SairEmergencia';
import { Texto } from '../../ui/Texto';

type Linha = { id: string; estado: string; iniciadaEm: string };

export const BADGE: Record<string, Estado> = { Aberta: 'aberta', Cancelada: 'cancelada', Encerrada: 'encerrada', Teste: 'teste' };
const VAZIO = 'Nenhuma ocorrência. Quando algo acontecer, aparece aqui.';

/** Do mais novo ao mais antigo; data inválida vai para o fim. */
function ordenar(lista: Linha[]): Linha[] {
  const t = (l: Linha) => {
    const v = Date.parse(l.iniciadaEm);
    return Number.isNaN(v) ? -Infinity : v;
  };
  return [...lista].sort((a, b) => t(b) - t(a));
}

export default function Historico() {
  const router = useRouter();
  const { escopo } = useSessao();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(() => {
    let vivo = true;
    setErro(undefined);
    (async () => {
      try {
        const db = await abrirBanco();
        // Em demonstração as ocorrências são as locais (funciona sem internet).
        const demo = (await sessaoRepo(db).get('demo')) === '1';
        const lista: Linha[] = demo ? await ocorrenciaRepo(db).listar() : await api.ocorrencias.listar();
        if (vivo) setLinhas(ordenar(lista.map((o) => ({ id: o.id, estado: o.estado, iniciadaEm: o.iniciadaEm }))));
      } catch (e) {
        if (vivo) setErro(mensagemDeErro(e));
      }
    })();
    return () => {
      vivo = false;
    };
    // `tentativa` só serve para refazer a carga no "Tentar de novo".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);
  useFocusEffect(carregar);

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Texto variante="titulo">Histórico</Texto>
      <SairEmergencia />
      {erro ? (
        <>
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erro}`}</Texto>
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => setTentativa((n) => n + 1)} />
        </>
      ) : null}
      {!linhas && !erro ? <Texto accessibilityLiveRegion="polite">Carregando...</Texto> : null}
      {linhas && linhas.length === 0 ? <Texto accessibilityLiveRegion="polite">{VAZIO}</Texto> : null}
      {(linhas ?? []).map((o) => {
        const quando = `${dataCurta(o.iniciadaEm)} às ${horaLocal(o.iniciadaEm)}`;
        const badge = BADGE[o.estado];
        return (
          <View key={o.id} style={estilos.bloco}>
            <Pressable
              testID={`linha-ocorrencia-${o.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Ocorrência de ${quando}, ${rotuloEstado(o.estado)}`}
              accessibilityHint="Abre a linha do tempo desta ocorrência"
              onPress={() => router.push(`/ocorrencia/${encodeURIComponent(o.id)}` as never)}
              style={estilos.linha}
            >
              <Texto>{quando}</Texto>
              {badge ? <EstadoBadge estado={badge} /> : <Texto variante="legenda">{rotuloEstado(o.estado)}</Texto>}
            </Pressable>
            {escopo === 'emergencia' ? (
              <Botao
                rotulo="Marcar onde foi (rota)"
                variante="secundario"
                onPress={() => router.push(`/rota?ocorrenciaId=${encodeURIComponent(o.id)}` as never)}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  bloco: { gap: espacos.p },
  linha: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    gap: espacos.p,
    padding: espacos.m,
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    backgroundColor: cores.branco,
  },
});
