// Único lugar que importa `leaflet`. Tiles do OpenStreetMap.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconeUrl from "leaflet/dist/images/marker-icon.png";
import icone2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import sombraUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef } from "react";

export type PontoMapa = { lat: number; lng: number; em: string };

// O Vite não resolve os caminhos de imagem que o Leaflet monta sozinho; as URLs entram de forma explícita.
const iconeMarcador = L.icon({
  iconUrl: iconeUrl,
  iconRetinaUrl: icone2xUrl,
  shadowUrl: sombraUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function Mapa({
  pontos,
  selecionado,
  aoSelecionar,
}: {
  pontos: PontoMapa[];
  selecionado: number;
  aoSelecionar: (i: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const aoSelRef = useRef(aoSelecionar);
  aoSelRef.current = aoSelecionar;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([-23.55, -46.63], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    camada.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      camada.current = null;
    };
  }, []);

  // Desenha a rota e os pontos. Só reenquadra quando a lista de pontos muda, não a cada ponto escolhido.
  useEffect(() => {
    const m = mapa.current;
    const g = camada.current;
    if (!m || !g || pontos.length === 0) return;
    const coords = pontos.map((p) => [p.lat, p.lng] as [number, number]);
    if (pontos.length > 1) m.fitBounds(L.latLngBounds(coords), { padding: [24, 24], maxZoom: 17 });
    else m.setView(coords[0], 16);
  }, [pontos]);

  useEffect(() => {
    const g = camada.current;
    if (!g) return;
    g.clearLayers();
    if (pontos.length === 0) return;
    L.polyline(
      pontos.map((p) => [p.lat, p.lng] as [number, number]),
      { color: "#0f4c4a", weight: 4 },
    ).addTo(g);
    pontos.forEach((p, i) => {
      // Raio de 14 px: alvo de toque confortável no iPhone (sem hover).
      L.circleMarker([p.lat, p.lng], { radius: 14, color: "#0f4c4a", fillColor: "#14b88a", fillOpacity: 0.85, weight: 2 })
        .on("click", () => aoSelRef.current(i))
        .addTo(g);
    });
    const sel = pontos[selecionado];
    if (sel) L.marker([sel.lat, sel.lng], { icon: iconeMarcador, keyboard: false, interactive: false }).addTo(g);
  }, [pontos, selecionado]);

  return <div ref={el} className="mapa" role="application" aria-label="Mapa do seu trajeto" />;
}
