// Linha do tempo da rota (P1): escolhe o dia, o horário e marca "foi aqui que me roubaram". A trilha só
// aparece para o dono; o app não mostra posição "atual" de nada. A lista de horários é a alternativa ao
// mapa e ao controle deslizante para leitor de tela.
import Slider from '@react-native-community/slider';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ApiErro, mensagemDeErro } from '../api/cliente';
import { api } from '../api/endpoints';
import type { PontoRotaDto } from '../api/tipos';
import { useSessao } from '../auth/sessao';
import { agruparPorDia, formatarHora } from '../rota/linhaDoTempo';
import { bordas, cores, espacos, raios, tamanhos } from '../theme/tokens';
import { Aviso } from '../ui/Aviso';
import { BarraAcao } from '../ui/BarraAcao';
import { Botao } from '../ui/Botao';
import { Icone } from '../ui/Icone';
import { LinhaNoMapa, MapaBase, MarcadorNoMapa } from '../ui/MapaBase';
import { SairEmergencia } from '../ui/SairEmergencia';
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
      <SairEmergencia />
      <View style={estilos.titulos}>
        <Texto variante="titulo">Onde você esteve</Texto>
        <Texto>Escolha o dia e o horário em que aconteceu.</Texto>
      </View>

      {erroTela ? (
        <>
          <Aviso mensagem={erroTela} />
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => void carregar()} />
        </>
      ) : null}
      {!pontos && !erroTela ? (
        <View style={estilos.carregando} accessibilityLiveRegion="polite">
          <ActivityIndicator color={cores.petroleo} />
          <Texto>Carregando...</Texto>
        </View>
      ) : null}
      {pontos && pontos.length === 0 ? (
        <View style={estilos.vazio} accessibilityLiveRegion="polite">
          <Icone nome="rota" tamanho={32} cor={cores.petroleo} />
          <Texto>{SEM_ROTA}</Texto>
        </View>
      ) : null}

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
                  style={({ pressed }) => [estilos.diaBotao, ativo && estilos.diaAtivo, pressed && !ativo && estilos.pressionado]}
                >
                  {ativo ? <Icone nome="ok" tamanho={16} cor={cores.areia} /> : null}
                  <Texto variante="rotulo" style={ativo ? estilos.diaTextoAtivo : estilos.diaTexto}>
                    {rotulo}
                  </Texto>
                </Pressable>
              );
            })}
          </View>

          <View style={estilos.mapa}>
            <MapaBase
              centro={ponto}
              zoom={15}
              descricao={`Mapa da sua rota. Ponto escolhido às ${formatarHora(ponto.em)}. Use a lista de horários para escolher.`}
            >
              <LinhaNoMapa id="trilha" pontos={lista} />
              <MarcadorNoMapa ponto={ponto} />
            </MapaBase>
          </View>

          <View style={estilos.cartao}>
            <View
              style={estilos.horario}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Horário escolhido: ${formatarHora(ponto.em)}`}
            >
              <Texto variante="legenda" style={estilos.suave}>
                Horário escolhido
              </Texto>
              <Texto variante="exibicao">{formatarHora(ponto.em)}</Texto>
            </View>
            {lista.length > 1 ? (
              <Slider
                testID="controle-horario"
                minimumValue={0}
                maximumValue={lista.length - 1}
                step={1}
                value={i}
                onValueChange={(v: number) => setIndice(Math.round(v))}
                minimumTrackTintColor={cores.petroleo}
                maximumTrackTintColor={cores.textoSuave}
                thumbTintColor={cores.petroleo}
                accessibilityRole="adjustable"
                accessibilityLabel="Horário na rota"
                accessibilityValue={{ text: `Às ${formatarHora(ponto.em)}` }}
                style={estilos.slider}
              />
            ) : null}
          </View>

          <Texto variante="secao" style={estilos.secao}>
            Horários do dia
          </Texto>
        </>
      ) : null}
    </View>
  );

  const escolherHorario = useCallback((index: number) => {
    setIndice(index);
    setErroMarcar(undefined);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: PontoRotaDto; index: number }) => (
      <LinhaHorario
        hora={formatarHora(item.em)}
        ativo={index === i}
        primeira={index === 0}
        ultima={index === lista.length - 1}
        aoEscolher={() => escolherHorario(index)}
      />
    ),
    [i, lista.length, escolherHorario],
  );

  return (
    <View style={estilos.fundo}>
      <FlatList
        testID="lista-horarios"
        style={estilos.rolagem}
        data={lista}
        keyExtractor={(p) => p.em}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={estilos.tela}
        extraData={i}
        initialNumToRender={20}
        renderItem={renderItem}
      />
      {dia && ponto ? (
        <BarraAcao>
          {erroMarcar ? <Aviso mensagem={erroMarcar} /> : null}
          <Botao
            rotulo="Foi aqui que me roubaram"
            carregando={marcando}
            onPress={() => void marcar()}
            dica="Marca este horário e este lugar na ocorrência"
          />
        </BarraAcao>
      ) : null}
    </View>
  );
}

// Linha de horário: preenchimento (esmeraldaSuave), ícone e peso bold marcam o escolhido, sem depender de cor.
// Memoizada: tocar num horário não redesenha as outras linhas.
const LinhaHorario = memo(function LinhaHorario({
  hora,
  ativo,
  primeira,
  ultima,
  aoEscolher,
}: {
  hora: string;
  ativo: boolean;
  primeira: boolean;
  ultima: boolean;
  aoEscolher: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Às ${hora}`}
      accessibilityState={{ selected: ativo }}
      onPress={aoEscolher}
      style={({ pressed }) => [
        estilos.item,
        primeira && estilos.itemPrimeira,
        ultima && estilos.itemUltima,
        ativo && estilos.itemAtivo,
        pressed && !ativo && estilos.pressionado,
      ]}
    >
      <Texto variante={ativo ? 'corpoForte' : 'corpo'}>{hora}</Texto>
      {ativo ? <Icone nome="ok" tamanho={20} cor={cores.petroleo} /> : null}
    </Pressable>
  );
});

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.areia },
  rolagem: { flex: 1 },
  tela: { padding: espacos.m, paddingBottom: espacos.g },
  cabecalho: { gap: espacos.m, marginBottom: espacos.p },
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
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.p },
  diaBotao: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    flexDirection: 'row',
    gap: espacos.xs,
    paddingHorizontal: espacos.m,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: raios.m,
    backgroundColor: cores.areiaFunda,
  },
  diaAtivo: { backgroundColor: cores.petroleo },
  diaTexto: { color: cores.petroleo },
  diaTextoAtivo: { color: cores.areia },
  mapa: { borderRadius: raios.m, overflow: 'hidden', borderWidth: bordas.fina, borderColor: cores.bordaSuave },
  cartao: {
    gap: espacos.p,
    padding: espacos.m,
    borderRadius: raios.m,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
  },
  horario: { gap: espacos.xs },
  suave: { color: cores.textoSuave },
  slider: { height: tamanhos.alvoMin, width: '100%' },
  secao: { marginTop: espacos.p },
  item: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.m,
    borderLeftWidth: bordas.fina,
    borderRightWidth: bordas.fina,
    borderBottomWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    backgroundColor: cores.branco,
  },
  itemPrimeira: { borderTopWidth: bordas.fina, borderTopLeftRadius: raios.m, borderTopRightRadius: raios.m },
  itemUltima: { borderBottomLeftRadius: raios.m, borderBottomRightRadius: raios.m },
  itemAtivo: { backgroundColor: cores.esmeraldaSuave },
  pressionado: { backgroundColor: cores.areiaFunda },
});
