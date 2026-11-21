"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

/** Swappable vector tile style (public, safe for the browser). Default: OpenFreeMap "liberty" (free, no key). */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";

export interface MapMarker {
  name: string;
  lng: number;
  lat: number;
  kind?: "start" | "end" | "stop";
}

interface Props {
  markers: MapMarker[];
  /** Optional route polyline as [lng, lat] pairs. */
  path?: [number, number][];
  center?: [number, number];
  zoom?: number;
  height?: number;
  label: string;
  /** Rendered if WebGL or the tile style cannot load. */
  fallback: React.ReactNode;
}

/** MapLibre GL JS map with markers and an optional dashed route line. */
export function MapCanvas({ markers, path, center, zoom, height = 320, label, fallback }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    let instance: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled || !container.current) return;
        maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
        let m: import("maplibre-gl").Map;
        try {
          m = new maplibregl.Map({
            container: container.current,
            style: MAP_STYLE_URL,
            center: center ?? [markers[0].lng, markers[0].lat],
            zoom: zoom ?? 5,
            attributionControl: { compact: true },
            cooperativeGestures: true,
          });
        } catch {
          setFailed(true);
          return;
        }
        instance = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        m.on("error", (e) => {
          if (!m.isStyleLoaded() && /style|fetch/i.test(String(e?.error?.message ?? ""))) setFailed(true);
        });
        if (path && path.length > 1) {
          const bounds = path.reduce(
            (b, p) => b.extend(p),
            new maplibregl.LngLatBounds(path[0], path[0]),
          );
          m.fitBounds(bounds, { padding: { top: 40, bottom: 60, left: 60, right: 60 }, duration: 0 });
          m.on("load", () => {
            m.addSource("route", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path } },
            });
            m.addLayer({
              id: "route-casing",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 },
            });
            m.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#d9822b", "line-width": 4, "line-dasharray": [1.5, 1.5] },
            });
          });
        }
        for (const p of markers) {
          const el = document.createElement("div");
          el.className = `map-pin ${p.kind ?? ""}`;
          el.title = p.name;
          new maplibregl.Marker({ element: el })
            .setLngLat([p.lng, p.lat])
            .setPopup(new maplibregl.Popup({ offset: 14 }).setText(p.name))
            .addTo(m);
          const lab = document.createElement("div");
          lab.className = "map-label";
          lab.textContent = p.name;
          new maplibregl.Marker({ element: lab, anchor: "top", offset: [0, 10] }).setLngLat([p.lng, p.lat]).addTo(m);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      instance?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <>{fallback}</>;
  return <div ref={container} className="map-canvas" style={{ height }} aria-label={label} role="region" />;
}
