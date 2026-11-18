import { layerIds, type MapTheme } from "@/lib/map/themes";

export const POINTS_SOURCE = "nagrek-points";
export const POINTS_LAYER = "nagrek-points";
export const POINTS_LABEL = "nagrek-points-label";

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "city" | "you";
};

export type MapView = { lng: number; lat: number; zoom: number };

export const FALLBACK_VIEW: MapView = { lng: 77.59, lat: 12.97, zoom: 11 };

export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { name: string; kind: MapPoint["kind"] };
  }[];
};

type PointSource = { setData: (data: MapFeatureCollection) => void };

export type OverlayMap = {
  getSource: (id: string) => PointSource | undefined;
  addSource: (id: string, source: { type: "geojson"; data: MapFeatureCollection }) => void;
  getLayer: (id: string) => unknown;
  addLayer: (layer: object) => void;
  setPaintProperty: (layer: string, name: string, value: unknown) => void;
  setLayoutProperty: (layer: string, name: string, value: unknown) => void;
};

export function normalizeView(view: MapView): MapView {
  if (!Number.isFinite(view.lat) || !Number.isFinite(view.lng) || view.lat < -90 || view.lat > 90 || view.lng < -180 || view.lng > 180) {
    return FALLBACK_VIEW;
  }
  const zoom = Number.isFinite(view.zoom) ? Math.min(18, Math.max(2, view.zoom)) : FALLBACK_VIEW.zoom;
  return { lng: view.lng, lat: view.lat, zoom };
}

export function mapPoints(points: MapPoint[]): MapFeatureCollection {
  const seen = new Set<string>();
  const features: MapFeatureCollection["features"] = [];
  for (const point of points) {
    const name = point.name.trim();
    if (!name || seen.has(point.id)) continue;
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) continue;
    seen.add(point.id);
    features.push({
      type: "Feature",
      id: point.id,
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      properties: { name, kind: point.kind },
    });
  }
  return { type: "FeatureCollection", features };
}

export function applyGroupVisibility(map: OverlayMap, ids: string[], visible: boolean) {
  const value = visible ? "visible" : "none";
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}

function paintPoints(map: OverlayMap, theme: MapTheme) {
  if (!map.getLayer(POINTS_LAYER)) return;
  const dark = theme === "dark";
  map.setPaintProperty(POINTS_LAYER, "circle-stroke-color", dark ? "#141210" : "#ffffff");
  map.setPaintProperty(POINTS_LABEL, "text-color", dark ? "#f5f0ea" : "#3c3834");
  map.setPaintProperty(POINTS_LABEL, "text-halo-color", dark ? "#141210" : "#f4f1ea");
}

export function syncPoints(map: OverlayMap, points: MapPoint[], theme: MapTheme) {
  const data = mapPoints(points);
  const existing = map.getSource(POINTS_SOURCE);
  if (existing) {
    existing.setData(data);
    paintPoints(map, theme);
    return;
  }
  map.addSource(POINTS_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: POINTS_LAYER,
    type: "circle",
    source: POINTS_SOURCE,
    paint: {
      "circle-radius": ["match", ["get", "kind"], "you", 8, 6],
      "circle-color": ["match", ["get", "kind"], "you", "#8eb7ff", "#ff7e5f"],
      "circle-stroke-width": 2,
      "circle-stroke-color": theme === "dark" ? "#141210" : "#ffffff",
    },
  });
  map.addLayer({
    id: POINTS_LABEL,
    type: "symbol",
    source: POINTS_SOURCE,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-offset": [0, 1.15],
      "text-anchor": "top",
      "text-font": ["Noto Sans Regular"],
    },
    paint: {
      "text-color": theme === "dark" ? "#f5f0ea" : "#3c3834",
      "text-halo-color": theme === "dark" ? "#141210" : "#f4f1ea",
      "text-halo-width": 1.2,
    },
  });
}

export function restoreOverlays(
  map: OverlayMap,
  state: { theme: MapTheme; points: MapPoint[]; labels: boolean; pois: boolean },
) {
  applyGroupVisibility(map, layerIds(state.theme, "labels"), state.labels);
  applyGroupVisibility(map, layerIds(state.theme, "poi"), state.pois);
  syncPoints(map, state.points, state.theme);
}
