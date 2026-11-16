// Linha do tempo da rota (P1): escolhe o dia, o horário e marca "foi aqui que me roubaram". A trilha só
// aparece para o dono; o app não mostra posição "atual" de nada. A lista de horários é a alternativa ao
// mapa e ao controle deslizante para leitor de tela.
import Slider from '@react-native-community/slider';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { PontoRotaDto } from '../api/tipos';
import { useSessao } from '../auth/sessao';
import { agruparPorDia, formatarHora } from '../rota/linhaDoTempo';
import { cores, espacos, tamanhos } from '../theme/tokens';
import { Botao } from '../ui/Botao';
import { LinhaNoMapa, MapaBase, MarcadorNoMapa } from '../ui/MapaBase';
import { Texto } from '../ui/Texto';

const DIAS_DE_HISTORICO = 7;
const SEM_ROTA = 'Nenhuma rota nos últimos 7 dias. Confira se a rota está ligada em Ajustes.';
const SEM_OCORRENCIA = 'Nenhuma ocorrência aberta. Peça ajuda a um guardião ou abra uma ocorrência antes de marcar o momento.';
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "2026-11-12" -> "qui 12" (dia da semana calculado em UTC ao meio-dia, sem depender de Intl). */
export function rotuloDoDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return `${SEMANA[new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()]} ${d}`;
}

export default function Rota() {
  const { ocorrenciaId: param } = useLocalSearchParams<{ ocorrenciaId?: string }>();
  const router = useRouter();
  const { escopo } = useSessao();
  const [pontos, setPontos] = useState<PontoRotaDto[] | null>(null);
  const [erroTela, setErroTela] = useState<string | undefined>();
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [indice, setIndice] = useState<number | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [erroMarcar, setErroMarcar] = useState<string | undefined>();
  const montada = useRef(true);
  // Ocorrência já resolvida (ou aberta pelo gatilho): nova tentativa reaproveita, nunca abre outra.
  const ocorrenciaResolvida = useRef<string | null>(null);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setErroTela(undefined);
    const ate = new Date();
    const de = new Date(ate.getTime() - DIAS_DE_HISTORICO * 24 * 60 * 60 * 1000);
    try {
      const lista = await api.rota.obter(de.toISOString(), ate.toISOString());
      if (montada.current) setPontos(lista);
    } catch (e) {
      if (montada.current) setErroTela(mensagemDeErro(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const dias = useMemo(() => (pontos ? agruparPorDia(pontos) : []), [pontos]);
  const dia = dias.find((d) => d.dia === diaEscolhido) ?? dias[0];
  const lista = dia?.pontos ?? [];
  const i = lista.length === 0 ? -1 : Math.min(indice ?? lista.length - 1, lista.length - 1);
  const ponto = i >= 0 ? lista[i] : null;

  function escolherDia(d: string) {
    setDiaEscolhido(d);
    setIndice(null);
    setErroMarcar(undefined);
  }

  /** Ocorrência do parâmetro, ou a mais recente; só no modo emergência abre uma nova (lacuna L9). */
  async function resolverOcorrencia(): Promise<string | null> {
    if (typeof param === 'string' && param) return param;
    if (ocorrenciaResolvida.current) return ocorrenciaResolvida.current;
    let existentes: { id: string; iniciadaEm: string }[] = [];
    try {
      existentes = await api.ocorrencias.listar();
    } catch (e) {
      // No modo emergência só 401/403 (token que não lista) segue para o gatilho; erro de rede não abre ocorrência.
      const semPermissao = e instanceof ApiErro && (e.status === 401 || e.status === 403);
      if (escopo !== 'emergencia' || !semPermissao) throw e;
    }
    if (existentes.length > 0) {
      const id = [...existentes].sort((a, b) => Date.parse(b.iniciadaEm) - Date.parse(a.iniciadaEm))[0].id;
      ocorrenciaResolvida.current = id;
      return id;
    }
    if (escopo === 'emergencia') {
      const id = (await api.ocorrencias.gatilho('web')).ocorrenciaId;
      ocorrenciaResolvida.current = id;
      return id;
    }
    return null;
  }

  async function marcar() {
    if (!ponto || marcando) return;
    setErroMarcar(undefined);
    setMarcando(true);
    try {
      const id = await resolverOcorrencia();
      if (!id) {
        if (montada.current) setErroMarcar(SEM_OCORRENCIA);
        return;
      }
      await api.ocorrencias.momento(id, { em: ponto.em, lat: ponto.lat, lng: ponto.lng });
      if (montada.current) router.push(`/bo?ocorrenciaId=${encodeURIComponent(id)}` as never);
    } catch (e) {
      if (montada.current) setErroMarcar(mensagemDeErro(e));
    } finally {
      if (montada.current) setMarcando(false);
    }
  }

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <Stack.Screen options={{ title: 'Minha rota' }} />
      <Texto variante="titulo">Onde você esteve</Texto>
      <Texto>Escolha o dia e o horário em que aconteceu.</Texto>

      {erroTela ? (
        <>
          <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erroTela}`}</Texto>
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} />
        </>
      ) : null}
      {!pontos && !erroTela ? <Texto accessibilityLiveRegion="polite">Carregando...</Texto> : null}
      {pontos && pontos.length === 0 ? <Texto accessibilityLiveRegion="polite">{SEM_ROTA}</Texto> : null}

      {dia && ponto ? (
        <>
          <View style={estilos.dias} accessibilityRole="radiogroup">
            {dias.map((d) => {
              const rotulo = rotuloDoDia(d.dia);
              const ativo = d.dia === dia.dia;
              return (
                <Pressable
                  key={d.dia}
                  accessibilityRole="radio"
                  accessibilityLabel={`Dia ${rotulo}`}
                  accessibilityState={{ selected: ativo }}
                  onPress={() => escolherDia(d.dia)}
                  style={[estilos.diaBotao, ativo && estilos.diaAtivo]}
                >
                  <Texto variante="legenda" style={ativo ? estilos.diaTextoAtivo : undefined}>
                    {rotulo}
                  </Texto>
                </Pressable>
              );
            })}
          </View>

          <MapaBase
            centro={ponto}
            zoom={15}
            descricao={`Mapa da sua rota. Ponto escolhido às ${formatarHora(ponto.em)}. Use a lista de horários para escolher.`}
          >
            <LinhaNoMapa id="trilha" pontos={lista} />
            <MarcadorNoMapa ponto={ponto} />
          </MapaBase>

          <Texto accessibilityLiveRegion="polite">{`Horário escolhido: ${formatarHora(ponto.em)}`}</Texto>
          {lista.length > 1 ? (
            <Slider
              testID="controle-horario"
              minimumValue={0}
              maximumValue={lista.length - 1}
              step={1}
              value={i}
              onValueChange={(v: number) => setIndice(Math.round(v))}
              minimumTrackTintColor={cores.petroleo}
              maximumTrackTintColor={cores.tinta}
              thumbTintColor={cores.petroleo}
              accessibilityRole="adjustable"
              accessibilityLabel="Horário na rota"
              accessibilityValue={{ text: `Às ${formatarHora(ponto.em)}` }}
              style={estilos.slider}
            />
          ) : null}

          <Botao
            rotulo="Foi aqui que me roubaram"
            carregando={marcando}
            onPress={() => void marcar()}
            dica="Marca este horário e este lugar na ocorrência"
          />
          {erroMarcar ? (
            <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{`⚠ ${erroMarcar}`}</Texto>
          ) : null}
          <Texto variante="titulo" style={estilos.subtitulo}>
            Horários do dia
          </Texto>
        </>
      ) : null}
    </View>
  );

  return (
    <FlatList
      testID="lista-horarios"
      data={lista}
      keyExtractor={(p) => p.em}
      ListHeaderComponent={cabecalho}
      contentContainerStyle={estilos.tela}
      extraData={i}
      initialNumToRender={20}
      renderItem={({ item, index }) => {
        const hora = formatarHora(item.em);
        const ativo = index === i;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Às ${hora}`}
            accessibilityState={{ selected: ativo }}
            onPress={() => {
              setIndice(index);
              setErroMarcar(undefined);
            }}
            style={[estilos.item, ativo && estilos.itemAtivo]}
          >
            <Texto style={ativo ? estilos.itemTextoAtivo : undefined}>{hora}</Texto>
          </Pressable>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.p },
  cabecalho: { gap: espacos.m, marginBottom: espacos.p },
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.p },
  diaBotao: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    paddingHorizontal: espacos.m,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    backgroundColor: cores.areia,
  },
  diaAtivo: { backgroundColor: cores.petroleo },
  diaTextoAtivo: { color: cores.areia },
  slider: { height: tamanhos.alvoMin, width: '100%' },
  subtitulo: { fontSize: 20, lineHeight: 28 },
  item: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    justifyContent: 'center',
    paddingHorizontal: espacos.m,
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    backgroundColor: cores.branco,
  },
  itemAtivo: { backgroundColor: cores.petroleo },
  itemTextoAtivo: { color: cores.areia },
});
