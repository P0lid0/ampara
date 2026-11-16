// Única porta de entrada do MapLibre no app: se a API mudar entre versões, só este arquivo muda.
// Estilo raster inline (tiles do OpenStreetMap), sem chave e sem download de estilo.
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { cores, coresRisco, espacos } from '../theme/tokens';
import type { Bbox } from '../api/tipos';
import { Texto } from './Texto';

export type Coordenada = { lat: number; lng: number };

export const ATRIBUICAO = '© OpenStreetMap';

const ESTILO = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: ATRIBUICAO,
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

export type MapaBaseProps = {
  centro: Coordenada;
  zoom: number;
  children?: ReactNode;
  /** Descrição para leitor de tela (o mapa em si não é navegável; há alternativa em lista). */
  descricao?: string;
  /** Chamado quando o mapa para de mexer, com a área visível. */
  aoParar?: (area: Bbox) => void;
};

export function MapaBase({ centro, zoom, children, descricao, aoParar }: MapaBaseProps) {
  return (
    <View
      style={estilos.caixa}
      accessible={Boolean(descricao)}
      accessibilityLabel={descricao}
      importantForAccessibility={descricao ? 'yes' : 'auto'}
    >
      <Map
        style={estilos.mapa}
        mapStyle={ESTILO}
        attribution={false}
        onRegionDidChange={aoParar ? (e) => aoParar(paraBbox(e.nativeEvent.bounds)) : undefined}
      >
        <Camera center={[centro.lng, centro.lat]} zoom={zoom} />
        {children}
      </Map>
      <View style={estilos.atribuicao} pointerEvents="none">
        <Texto variante="legenda" style={estilos.atribuicaoTexto}>
          {ATRIBUICAO}
        </Texto>
      </View>
    </View>
  );
}

/** `[oeste, sul, leste, norte]` do MapLibre vira a área do contrato. */
function paraBbox(b: readonly number[]): Bbox {
  return { minLng: b[0], minLat: b[1], maxLng: b[2], maxLat: b[3] };
}

/** Linha sobre o mapa (a trilha do dia). Precisa de 2 pontos ou mais. */
export function LinhaNoMapa({ id, pontos }: { id: string; pontos: readonly Coordenada[] }) {
  if (pontos.length < 2) return null;
  const dados = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: pontos.map((p) => [p.lng, p.lat]) },
  };
  return (
    <GeoJSONSource id={`${id}-fonte`} data={dados}>
      <Layer id={`${id}-linha`} type="line" paint={{ 'line-color': cores.petroleo, 'line-width': 4 }} />
    </GeoJSONSource>
  );
}

/** Marcador no ponto escolhido (círculo de alto contraste). */
export function MarcadorNoMapa({ ponto }: { ponto: Coordenada }) {
  return (
    <Marker lngLat={[ponto.lng, ponto.lat]}>
      <View style={estilos.marcador} />
    </Marker>
  );
}

export type ClasseCelula = 'baixo' | 'medio' | 'alto' | 'sem';
export type CelulaNoMapa = { areaId: string; classe: ClasseCelula; limites: { minLat: number; minLng: number; maxLat: number; maxLng: number } };

/**
 * Células de risco como polígonos. Cor E padrão de borda (nunca só cor): baixo = borda fina contínua,
 * médio = tracejada, alto = grossa, sem dado = pontilhada em cinza.
 */
export function CelulasNoMapa({ celulas }: { celulas: readonly CelulaNoMapa[] }) {
  const dados = {
    type: 'FeatureCollection' as const,
    features: celulas.map((c) => ({
      type: 'Feature' as const,
      properties: { classe: c.classe, areaId: c.areaId },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [c.limites.minLng, c.limites.minLat], [c.limites.maxLng, c.limites.minLat],
          [c.limites.maxLng, c.limites.maxLat], [c.limites.minLng, c.limites.maxLat],
          [c.limites.minLng, c.limites.minLat],
        ]],
      },
    })),
  };
  const e = (classe: ClasseCelula) => ['==', ['get', 'classe'], classe] as never;
  return (
    <GeoJSONSource id="risco-fonte" data={dados}>
      <Layer
        id="risco-fundo"
        type="fill"
        paint={{
          'fill-color': ['match', ['get', 'classe'], 'baixo', COR_CELULA.baixo, 'medio', COR_CELULA.medio, 'alto', COR_CELULA.alto, COR_CELULA.sem] as never,
          'fill-opacity': 0.4,
        }}
      />
      <Layer id="risco-baixo" type="line" filter={e('baixo')} paint={{ 'line-color': cores.tinta, 'line-width': 1 }} />
      <Layer id="risco-medio" type="line" filter={e('medio')} paint={{ 'line-color': cores.tinta, 'line-width': 2, 'line-dasharray': [3, 2] }} />
      <Layer id="risco-alto" type="line" filter={e('alto')} paint={{ 'line-color': cores.tinta, 'line-width': 4 }} />
      <Layer id="risco-sem" type="line" filter={e('sem')} paint={{ 'line-color': cores.tinta, 'line-width': 2, 'line-dasharray': [0.5, 2] }} />
    </GeoJSONSource>
  );
}

export const COR_CELULA: Record<ClasseCelula, string> = coresRisco;

/** Marcador com ícone (uma letra num distintivo) e o nome em texto. */
export function PontoRotulado({ ponto, icone, nome }: { ponto: Coordenada; icone: string; nome: string }) {
  return (
    <Marker lngLat={[ponto.lng, ponto.lat]}>
      <View style={estilos.rotulado}>
        <View style={estilos.icone}>
          <Texto variante="legenda" style={estilos.iconeTexto}>{icone}</Texto>
        </View>
        <Texto variante="legenda" style={estilos.nome}>{nome}</Texto>
      </View>
    </Marker>
  );
}

const estilos = StyleSheet.create({
  rotulado: { alignItems: 'center' },
  icone: {
    minWidth: 28, height: 28, borderRadius: 6, backgroundColor: cores.petroleo, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: cores.branco,
  },
  iconeTexto: { color: cores.branco, fontWeight: '700' },
  nome: { backgroundColor: cores.branco, color: cores.tinta, paddingHorizontal: 4 },
  marcador: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: cores.alarme,
    borderWidth: 3,
    borderColor: cores.branco,
  },
  caixa: { height: 280, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: cores.petroleo },
  mapa: { flex: 1 },
  atribuicao: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: cores.branco,
    paddingHorizontal: espacos.p,
  },
  atribuicaoTexto: { color: cores.tinta },
});
