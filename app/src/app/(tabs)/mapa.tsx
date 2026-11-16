// Aba Mapa (P2): risco por área e faixa horária (cor, padrão de borda e texto), relatos recentes e as
// camadas Delegacias, Estações e PM. Área que a API não devolveu é "Sem dado", nunca "baixo".
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { api } from '../../api/endpoints';
import type { Bbox, CamadaPontoDto, RelatoDto, RiscoDto } from '../../api/tipos';
import {
  celulasDoMapa, consultaRisco, idadeRelato, PINHEIROS, relatoVisivel, ROTULO_SEM_DADO, ROTULO_TIPO_RELATO, rotuloClasse,
  type ClasseRisco,
} from '../../mapa/risco';
import { cores, coresApoio, espacos, tamanhos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import {
  CelulasNoMapa, COR_CELULA, MapaBase, PontoRotulado, type CelulaNoMapa, type ClasseCelula,
} from '../../ui/MapaBase';
import { Texto } from '../../ui/Texto';

type TipoCamada = 'delegacias' | 'estacoes' | 'pm';
const CAMADAS: { tipo: TipoCamada; rotulo: string; icone: string; falha: string }[] = [
  { tipo: 'delegacias', rotulo: 'Delegacias', icone: 'D', falha: 'Não deu para carregar as delegacias agora.' },
  { tipo: 'estacoes', rotulo: 'Estações', icone: 'E', falha: 'Não deu para carregar as estações agora.' },
  { tipo: 'pm', rotulo: 'PM', icone: 'PM', falha: 'Não deu para carregar os pontos da PM agora.' },
];
const ICONE_RELATO: Record<string, string> = { roubo: 'R', furto: 'F', suspeita: 'S' };

const DEBOUNCE_MS = 500;
const TEMPO_GPS_MS = 8000;

const bboxAoRedor = (c: { lat: number; lng: number }): Bbox => ({
  minLat: c.lat - 0.02, maxLat: c.lat + 0.02, minLng: c.lng - 0.022, maxLng: c.lng + 0.022,
});

const LEGENDA: { classe: ClasseCelula; texto: string; borda: object }[] = [
  { classe: 'baixo', texto: rotuloClasse('baixo'), borda: { borderWidth: 1, borderStyle: 'solid' } },
  { classe: 'medio', texto: rotuloClasse('medio'), borda: { borderWidth: 2, borderStyle: 'dashed' } },
  { classe: 'alto', texto: rotuloClasse('alto'), borda: { borderWidth: 4, borderStyle: 'solid' } },
  { classe: 'sem', texto: ROTULO_SEM_DADO, borda: { borderWidth: 2, borderStyle: 'dotted' } },
];

/** Centro da área visível: é o ponto do relato quando a pessoa usa "Relatar aqui" (item 6). */
const centroDe = (b: Bbox) => ({ lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 });

export default function Mapa() {
  const router = useRouter();
  const [centro, setCentro] = useState<{ lat: number; lng: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [risco, setRisco] = useState<RiscoDto[]>([]);
  const [erroRisco, setErroRisco] = useState(false);
  const [relatos, setRelatos] = useState<RelatoDto[]>([]);
  const [erroRelatos, setErroRelatos] = useState(false);
  const [ligadas, setLigadas] = useState<Record<TipoCamada, boolean>>({ delegacias: false, estacoes: false, pm: false });
  const [pontos, setPontos] = useState<Partial<Record<TipoCamada, CamadaPontoDto[]>>>({});
  const [errosCamada, setErrosCamada] = useState<Partial<Record<TipoCamada, boolean>>>({});
  const [confirmacao, setConfirmacao] = useState<Record<string, 'enviando' | 'ok' | 'erro'>>({});
  const carregando = useRef<Partial<Record<TipoCamada, boolean>>>({});
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Posição do cidadão; sem permissão ou sem sinal, Pinheiros e um aviso.
  useEffect(() => {
    let ativo = true;
    (async () => {
      let ponto = PINHEIROS;
      let texto: string | null = null;
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          // Sem fix (GPS frio, dentro de predio) a promise pode nunca resolver: limita a espera.
          let relogio: ReturnType<typeof setTimeout> | undefined;
          const limite = new Promise<never>((_, rejeita) => {
            relogio = setTimeout(() => rejeita(new Error('gps')), TEMPO_GPS_MS);
          });
          try {
            const p = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              limite,
            ]);
            ponto = { lat: p.coords.latitude, lng: p.coords.longitude };
          } finally {
            if (relogio) clearTimeout(relogio);
          }
        } else {
          texto = 'Sem permissão de localização: mostrando a região de Pinheiros.';
        }
      } catch {
        texto = 'Não deu para achar sua localização: mostrando a região de Pinheiros.';
      }
      if (!ativo) return;
      setAviso(texto);
      setCentro(ponto);
      setBbox(bboxAoRedor(ponto));
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  // Risco e relatos da área visível. Falha num não derruba o outro.
  useEffect(() => {
    if (!bbox) return;
    let ativo = true;
    const { dia, faixa } = consultaRisco(bbox, new Date());
    api.risco
      .consultar(bbox, dia, faixa)
      .then((r) => {
        if (!ativo) return;
        setRisco(r);
        setErroRisco(false);
      })
      .catch(() => {
        if (!ativo) return;
        setRisco([]);
        setErroRisco(true);
      });
    api.relatos
      .listar(bbox)
      .then((r) => {
        if (!ativo) return;
        setRelatos(r);
        setErroRelatos(false);
      })
      .catch(() => {
        if (!ativo) return;
        setRelatos([]);
        setErroRelatos(true);
      });
    return () => {
      ativo = false;
    };
  }, [bbox]);

  const aoParar = useCallback((area: Bbox) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setBbox(area), DEBOUNCE_MS);
  }, []);

  const alternar = useCallback(
    (tipo: TipoCamada, ligar: boolean) => {
      setLigadas((l) => ({ ...l, [tipo]: ligar }));
      if (!ligar || pontos[tipo] || carregando.current[tipo]) return;
      carregando.current[tipo] = true;
      setErrosCamada((e) => ({ ...e, [tipo]: false }));
      api.camadas
        .obter(tipo)
        .then((lista) => setPontos((p) => ({ ...p, [tipo]: lista })))
        .catch(() => {
          setErrosCamada((e) => ({ ...e, [tipo]: true }));
          setLigadas((l) => ({ ...l, [tipo]: false }));
        })
        .finally(() => {
          carregando.current[tipo] = false;
        });
    },
    [pontos],
  );

  const confirmar = useCallback(async (id: string) => {
    setConfirmacao((c) => ({ ...c, [id]: 'enviando' }));
    try {
      await api.relatos.confirmar(id);
      setConfirmacao((c) => ({ ...c, [id]: 'ok' }));
    } catch {
      setConfirmacao((c) => ({ ...c, [id]: 'erro' }));
    }
  }, []);

  const celulas = useMemo<CelulaNoMapa[]>(
    () => (bbox ? celulasDoMapa(bbox, risco, erroRisco) : []),
    [bbox, risco, erroRisco],
  );

  const atencaoMaxima = useMemo(
    () => risco.filter((r) => r.classe === 'alto').sort((a, b) => b.probAlto - a.probAlto).slice(0, 10),
    [risco],
  );

  const agora = new Date();
  const relatosVisiveis = relatos.filter((r) => relatoVisivel(r.em, agora));

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Texto variante="titulo">Mapa</Texto>
      {aviso ? <Texto accessibilityRole="alert">{aviso}</Texto> : null}

      {centro ? (
        <MapaBase
          centro={centro}
          zoom={13}
          aoParar={aoParar}
          descricao="Mapa de risco por área. Há uma lista em texto abaixo."
        >
          <CelulasNoMapa celulas={celulas} />
          {CAMADAS.filter((c) => ligadas[c.tipo]).flatMap((c) =>
            (pontos[c.tipo] ?? []).map((p, i) => (
              <PontoRotulado key={`${c.tipo}-${i}`} ponto={p} icone={c.icone} nome={p.nome} />
            )),
          )}
          {relatosVisiveis.map((r) => (
            <PontoRotulado
              key={`relato-${r.id}`}
              ponto={r}
              icone={ICONE_RELATO[r.tipo] ?? '!'}
              nome={ROTULO_TIPO_RELATO[r.tipo] ?? 'Relato'}
            />
          ))}
        </MapaBase>
      ) : (
        <Texto>Localizando…</Texto>
      )}

      {bbox ? (
        <Botao
          rotulo="Relatar aqui"
          variante="secundario"
          dica="Abre o relato no ponto do centro do mapa. Arraste o mapa antes para escolher outro lugar."
          onPress={() => {
            const c = centroDe(bbox);
            router.push(`/relato?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}` as never);
          }}
        />
      ) : null}

      {erroRisco ? <Texto accessibilityRole="alert">Não deu para carregar o risco agora.</Texto> : null}

      <View accessibilityRole="summary" style={estilos.bloco}>
        <Texto variante="titulo">Legenda</Texto>
        {LEGENDA.map((l) => (
          <View key={l.classe} style={estilos.linha}>
            <View style={[estilos.amostra, l.borda, { backgroundColor: COR_CELULA[l.classe] }]} />
            <Texto style={estilos.fluxo}>{l.texto}</Texto>
          </View>
        ))}
      </View>

      <View style={estilos.bloco}>
        <Texto variante="titulo">Camadas</Texto>
        {CAMADAS.map((c) => (
          <View key={c.tipo} style={[estilos.linha, estilos.alvo]}>
            <Texto style={estilos.fluxo}>{c.rotulo}</Texto>
            <Switch
              accessibilityLabel={c.rotulo}
              accessibilityRole="switch"
              value={ligadas[c.tipo]}
              onValueChange={(v) => alternar(c.tipo, v)}
              trackColor={{ true: cores.petroleo, false: coresApoio.cinzaChave }}
            />
          </View>
        ))}
        {CAMADAS.filter((c) => errosCamada[c.tipo]).map((c) => (
          <Texto key={c.tipo} accessibilityRole="alert">{c.falha}</Texto>
        ))}
      </View>

      <View style={estilos.bloco}>
        <Texto variante="titulo">Áreas com atenção máxima agora</Texto>
        {atencaoMaxima.length === 0 ? (
          <Texto>{erroRisco ? 'Sem informação por enquanto.' : 'Nenhuma área com atenção máxima nesta região.'}</Texto>
        ) : (
          atencaoMaxima.map((r) => (
            <Texto key={r.areaId}>{`Atenção máxima perto de ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</Texto>
          ))
        )}
      </View>

      <View style={estilos.bloco}>
        <Texto variante="titulo">Relatos recentes</Texto>
        {erroRelatos ? <Texto accessibilityRole="alert">Não deu para carregar os relatos agora.</Texto> : null}
        {!erroRelatos && relatosVisiveis.length === 0 ? <Texto>Nenhum relato nas últimas 2 horas nesta região.</Texto> : null}
        {relatosVisiveis.map((r) => {
          const estado = confirmacao[r.id];
          return (
            <View key={r.id} style={estilos.relato}>
              <Texto accessibilityRole="header">{ROTULO_TIPO_RELATO[r.tipo] ?? 'Relato'}</Texto>
              <Texto>{idadeRelato(r.em, agora)}</Texto>
              <Texto variante="legenda">{`${r.confirmacoes} confirmação(ões)`}</Texto>
              {estado === 'ok' ? (
                <Texto accessibilityRole="alert">Obrigado, sua confirmação foi enviada.</Texto>
              ) : (
                <>
                  {estado === 'erro' ? (
                    <Texto accessibilityRole="alert">Não deu para confirmar agora. Tente de novo.</Texto>
                  ) : null}
                  <Botao
                    rotulo="Confirmar que também vi"
                    variante="secundario"
                    carregando={estado === 'enviando'}
                    onPress={() => void confirmar(r.id)}
                  />
                </>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  bloco: { gap: espacos.p },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.m },
  alvo: { minHeight: tamanhos.alvoMin },
  fluxo: { flex: 1 },
  amostra: { width: 32, height: 32, borderColor: cores.tinta, borderRadius: 4 },
  relato: { gap: espacos.p, padding: espacos.m, borderWidth: 1, borderColor: cores.petroleo, borderRadius: 8 },
});
