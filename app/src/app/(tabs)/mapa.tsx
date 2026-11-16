// Aba Mapa (P2): risco por área e faixa horária (cor, padrão de borda e texto), relatos recentes e as
// camadas Delegacias, Estações e PM. Área que a API não devolveu é "Sem dado", nunca "baixo".
// Legenda, camadas e relatos em grupos (uma superfície com divisores); erro do risco tem "Tentar de novo".
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api/endpoints';
import type { Bbox, CamadaPontoDto, RelatoDto, RiscoDto } from '../../api/tipos';
import {
  celulasDoMapa, consultaRisco, idadeRelato, PINHEIROS, relatoVisivel, ROTULO_SEM_DADO, ROTULO_TIPO_RELATO, rotuloClasse,
  type ClasseRisco,
} from '../../mapa/risco';
import { cores, espacos, raios, tamanhos } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Grupo, TituloGrupo } from '../../ui/Grupo';
import { Icone } from '../../ui/Icone';
import { Interruptor } from '../../ui/Interruptor';
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
  const [carregandoRisco, setCarregandoRisco] = useState(true);
  const [tentativa, setTentativa] = useState(0);
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
    setCarregandoRisco(true);
    api.risco
      .consultar(bbox, dia, faixa)
      .then((r) => {
        if (!ativo) return;
        setRisco(r);
        setErroRisco(false);
        setCarregandoRisco(false);
      })
      .catch(() => {
        if (!ativo) return;
        setRisco([]);
        setErroRisco(true);
        setCarregandoRisco(false);
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
  }, [bbox, tentativa]);

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
      {aviso ? (
        <View style={estilos.info} accessibilityRole="alert">
          <Icone nome="info" tamanho={20} cor={cores.petroleo} />
          <Texto variante="legenda" style={estilos.fluxo}>{aviso}</Texto>
        </View>
      ) : null}

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
        <View style={estilos.esqueletoMapa} accessibilityLiveRegion="polite">
          <Texto>Localizando…</Texto>
        </View>
      )}

      {bbox ? (
        <Botao
          rotulo="Relatar aqui"
          dica="Abre o relato no ponto do centro do mapa. Arraste o mapa antes para escolher outro lugar."
          onPress={() => {
            const c = centroDe(bbox);
            router.push(`/relato?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}` as never);
          }}
        />
      ) : null}

      {erroRisco ? (
        <View style={estilos.erro}>
          <Aviso mensagem="Não deu para carregar o risco agora." />
          <Botao rotulo="Tentar de novo" variante="secundario" onPress={() => setTentativa((t) => t + 1)} />
        </View>
      ) : null}

      <TituloGrupo>Como ler o mapa</TituloGrupo>
      <View accessibilityRole="summary">
        <Grupo>
          <View style={estilos.linha}>
            <Texto variante="legenda" style={estilos.fluxo}>
              A cor e o contorno mostram o nível de atenção para o dia e a hora de agora. O contorno vale mesmo sem enxergar as cores.
            </Texto>
          </View>
          {LEGENDA.map((l) => (
            <View key={l.classe} style={estilos.linha}>
              <View style={[estilos.amostra, l.borda, { backgroundColor: COR_CELULA[l.classe] }]} />
              <Texto variante="corpoForte" style={estilos.fluxo}>{l.texto}</Texto>
            </View>
          ))}
          <View style={estilos.linha}>
            <Icone nome="info" tamanho={24} cor={cores.petroleo} />
            <Texto variante="legenda" style={estilos.fluxo}>
              Letras no mapa: R roubo, F furto, S atitude suspeita (últimas 2 horas).
            </Texto>
          </View>
        </Grupo>
      </View>

      <TituloGrupo>Camadas</TituloGrupo>
      <Grupo>
        {CAMADAS.map((c) => (
          <Interruptor
            key={c.tipo}
            rotulo={c.rotulo}
            dica={`Aparece no mapa com a letra ${c.icone}.`}
            valor={ligadas[c.tipo]}
            aoMudar={(v) => alternar(c.tipo, v)}
          />
        ))}
      </Grupo>
      {CAMADAS.filter((c) => errosCamada[c.tipo]).map((c) => (
        <Aviso key={c.tipo} mensagem={c.falha} />
      ))}

      <TituloGrupo>Áreas com atenção máxima agora</TituloGrupo>
      <Grupo>
        {atencaoMaxima.length === 0 ? (
          <View style={estilos.linha}>
            <Texto style={estilos.fluxo}>{erroRisco ? 'Sem informação por enquanto.' : carregandoRisco ? 'Carregando o risco da região…' : 'Nenhuma área com atenção máxima nesta região.'}</Texto>
          </View>
        ) : (
          atencaoMaxima.map((r) => (
            <View key={r.areaId} style={estilos.linha}>
              <Icone nome="alerta" tamanho={24} cor={cores.alarmeTexto} />
              <Texto style={estilos.fluxo}>{`Atenção máxima perto de ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</Texto>
            </View>
          ))
        )}
      </Grupo>

      <TituloGrupo>Relatos recentes</TituloGrupo>
      {erroRelatos ? <Aviso mensagem="Não deu para carregar os relatos agora." /> : null}
      {erroRelatos && relatosVisiveis.length === 0 ? null : (
      <Grupo>
        {!erroRelatos && relatosVisiveis.length === 0 ? (
          <View style={estilos.linha}>
            <Texto style={estilos.fluxo}>Nenhum relato nas últimas 2 horas nesta região.</Texto>
          </View>
        ) : null}
        {relatosVisiveis.map((r) => {
          const estado = confirmacao[r.id];
          return (
            <View key={r.id} style={estilos.relato}>
              <Texto variante="corpoForte" accessibilityRole="header">{ROTULO_TIPO_RELATO[r.tipo] ?? 'Relato'}</Texto>
              <Texto>{idadeRelato(r.em, agora)}</Texto>
              <Texto variante="legenda" style={estilos.suave}>
                {r.confirmacoes === 1 ? '1 pessoa confirmou' : `${r.confirmacoes} pessoas confirmaram`}
              </Texto>
              {estado === 'ok' ? (
                <View style={estilos.feito} accessibilityRole="alert">
                  <Icone nome="ok" tamanho={20} cor={cores.petroleo} />
                  <Texto variante="legenda" style={estilos.fluxo}>Obrigado, sua confirmação foi enviada.</Texto>
                </View>
              ) : (
                <>
                  {estado === 'erro' ? <Aviso mensagem="Não deu para confirmar agora. Tente de novo." /> : null}
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
      </Grupo>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, paddingBottom: espacos.gg, gap: espacos.m },
  fluxo: { flex: 1 },
  suave: { color: cores.textoSuave },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.pm, padding: espacos.m, minHeight: tamanhos.alvoMin },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: espacos.p, padding: espacos.pm, borderRadius: raios.m, backgroundColor: cores.areiaFunda },
  esqueletoMapa: { height: 280, borderRadius: raios.g, backgroundColor: cores.areiaFunda, alignItems: 'center', justifyContent: 'center' },
  erro: { gap: espacos.p },
  amostra: { width: 32, height: 32, borderColor: cores.tinta, borderRadius: 4 },
  relato: { gap: espacos.p, padding: espacos.m },
  feito: { flexDirection: 'row', alignItems: 'center', gap: espacos.p, padding: espacos.pm, borderRadius: raios.m, backgroundColor: cores.esmeraldaSuave },
});
