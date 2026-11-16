// Único lugar que importa `leaflet`. Tiles do OpenStreetMap.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { formatarHora } from "../lib/agruparPorDia";

export type PontoMapa = { lat: number; lng: number; em: string };

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
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
      if (i === selecionado) return;
      // Ponto pequeno e visível (não esconde a rota) + área de toque invisível de 48 px.
      L.circleMarker([p.lat, p.lng], { radius: 6, color: "#0f4c4a", fillColor: "#f4efe6", fillOpacity: 1, weight: 2, interactive: false }).addTo(g);
      L.circleMarker([p.lat, p.lng], { radius: 24, stroke: false, fillOpacity: 0, fillColor: "#0f4c4a" })
        .on("click", () => aoSelRef.current(i))
        .addTo(g);
    });
    // O escolhido: esmeralda com anel petróleo e a hora ao lado (o estado não depende só da cor).
    const sel = pontos[selecionado];
    if (sel) {
      L.circleMarker([sel.lat, sel.lng], { radius: 11, color: "#0f4c4a", weight: 4, fillColor: "#14b88a", fillOpacity: 1, interactive: false })
        .bindTooltip(formatarHora(sel.em), { permanent: true, direction: "auto", offset: [14, 0], className: "hora-escolhida" })
        .addTo(g);
    }
  }, [pontos, selecionado]);

  return <div ref={el} className="mapa" role="group" aria-label="Mapa do seu trajeto. Para escolher um ponto sem o mapa, use a lista de horários" />;
}
