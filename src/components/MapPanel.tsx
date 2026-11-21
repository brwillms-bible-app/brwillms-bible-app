"use client";

import type { MapInfo } from "@/lib/content";
import { MapCanvas } from "./MapCanvas";

/** Context map for a scene: MapLibre GL with a simple SVG fallback when WebGL/tiles are unavailable. */
export function MapPanel({ map }: { map?: MapInfo }) {
  if (!map) return null;
  const fallback = (
    <svg viewBox="0 0 100 100" role="img" aria-label={`Map: ${map.title}`}>
      <rect width="100" height="100" rx="6" fill="#bde7ff" />
      <path d="M5 30 Q25 10 50 18 T95 20 L95 95 L5 95 Z" fill="#f3dfa2" stroke="#b08d3c" strokeWidth="1" />
      {map.places.map((p) => (
        <g key={p.name}>
          <circle cx={p.x} cy={p.y} r="2.6" fill="#e5484d" stroke="#fff" strokeWidth="0.8" />
          <text x={p.x} y={p.y - 4} fontSize="4.2" textAnchor="middle" fill="#2b2b2b" fontWeight="700">
            {p.name}
          </text>
        </g>
      ))}
    </svg>
  );
  return (
    <section className="card map">
      <h3>🗺️ {map.title}</h3>
      <MapCanvas markers={map.places} center={map.center} zoom={map.zoom} label={`Map: ${map.title}`} fallback={fallback} />
      <p>{map.context}</p>
      <p className="fineprint">Locations are approximate. Map tiles © OpenFreeMap / OpenStreetMap contributors.</p>
    </section>
  );
}
