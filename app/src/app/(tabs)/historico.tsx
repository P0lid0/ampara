// Aba Histórico: ocorrências do dono do aparelho, da mais nova à mais antiga. O estado vem sempre em
// texto (Aberta/Cancelada/Encerrada) além do ícone. No modo emergência (aparelho de outra pessoa) a
// API só devolve as do dono e cada linha leva a "Marcar onde foi (rota)".
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api/endpoints';
import { mensagemDeErro } from '../../api/cliente';
import { useSessao } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { ocorrenciaRepo, sessaoRepo } from '../../db/repos';
import { rotuloEstado } from '../../guardiao/eventos';
import { dataCurta } from '../../guardiao/formatoData';
import { horaLocal } from '../../guardiao/notificacao';
import { bordas, cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { EstadoBadge, type Estado } from '../../ui/EstadoBadge';
import { Icone } from '../../ui/Icone';
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
      <View style={estilos.titulos}>
        <Texto variante="titulo">Suas ocorrências</Texto>
        <Texto>Toque numa ocorrência para ver o que já foi feito.</Texto>
      </View>
      <SairEmergencia />
      {erro ? (
        <>
          <Aviso mensagem={erro} />
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => setTentativa((n) => n + 1)} />
        </>
      ) : null}
      {!linhas && !erro ? (
        <View style={estilos.carregando} accessibilityLiveRegion="polite">
          <ActivityIndicator color={cores.petroleo} />
          <Texto>Carregando...</Texto>
        </View>
      ) : null}
      {linhas && linhas.length === 0 ? (
        <View style={estilos.vazio} accessibilityLiveRegion="polite">
          <Icone nome="relogio" tamanho={32} cor={cores.petroleo} />
          <Texto>{VAZIO}</Texto>
        </View>
      ) : null}
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
              style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
            >
              <View style={estilos.linhaTexto}>
                <Texto variante="corpoForte">{quando}</Texto>
                {badge ? <EstadoBadge estado={badge} /> : <Texto variante="legenda">{rotuloEstado(o.estado)}</Texto>}
              </View>
              <View style={estilos.seta}>
                <Icone nome="voltar" tamanho={20} cor={cores.petroleo} />
              </View>
            </Pressable>
            {escopo === 'emergencia' ? (
              <View style={estilos.acao}>
                <Botao
                  rotulo="Marcar onde foi (rota)"
                  variante="secundario"
                  onPress={() => router.push(`/rota?ocorrenciaId=${encodeURIComponent(o.id)}` as never)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  titulos: { gap: espacos.p },
  carregando: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm },
  vazio: {
    gap: espacos.pm,
    padding: espacos.m,
    borderRadius: raios.m,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
  },
  // Cartão: superfície branca com contorno de 1 px; o toque troca o fundo (sem escala em linha larga).
  bloco: {
    borderRadius: raios.m,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
    overflow: 'hidden',
  },
  linha: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.pm,
    padding: espacos.m,
  },
  pressionada: { backgroundColor: cores.areiaFunda },
  linhaTexto: { flex: 1, gap: espacos.p },
  // A seta de "voltar" girada 180 graus vira "avançar".
  seta: { transform: [{ rotate: '180deg' }] },
  acao: { paddingHorizontal: espacos.m, paddingBottom: espacos.m },
});
