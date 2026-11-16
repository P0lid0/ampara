// Única porta de entrada do MapLibre no app: se a API mudar entre versões, só este arquivo muda.
// Estilo raster inline (tiles do OpenStreetMap), sem chave e sem download de estilo.
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { cores, espacos } from '../theme/tokens';
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
};

export function MapaBase({ centro, zoom, children, descricao }: MapaBaseProps) {
  return (
    <View
      style={estilos.caixa}
      accessible={Boolean(descricao)}
      accessibilityLabel={descricao}
      importantForAccessibility={descricao ? 'yes' : 'auto'}
    >
      <Map style={estilos.mapa} mapStyle={ESTILO} attribution={false}>
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

const estilos = StyleSheet.create({
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
