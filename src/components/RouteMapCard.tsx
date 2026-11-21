"use client";

import type { MapRoute } from "@/lib/content";
import { MapCanvas } from "./MapCanvas";

/** "The Journey" card: a dashed route line between stops on a MapLibre map. */
export function RouteMapCard({ route }: { route: MapRoute }) {
  const fallback = (
    <div className="map-fallback">
      {route.stops.map((s) => s.name).join(" → ")}
    </div>
  );
  return (
    <section className="card map journey" data-testid="route-map">
      <h3>📍 {route.title}</h3>
      <MapCanvas markers={route.stops} path={route.path} height={300} label={`Map: ${route.title}`} fallback={fallback} />
      <p>{route.context}</p>
      <p className="fineprint">Approximate route. Map tiles © OpenFreeMap / OpenStreetMap contributors.</p>
    </section>
  );
}
