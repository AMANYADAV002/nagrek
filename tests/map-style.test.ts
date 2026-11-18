import { describe, expect, it } from "vitest";
import { applyGroupVisibility, mapPoints, normalizeView, restoreOverlays, syncPoints, type MapFeatureCollection, type OverlayMap } from "@/lib/map/overlay";
import { DARK_COLORS, DARK_STYLE_URL, LIBERTY_STYLE_URL, LIGHT_COLORS, layerIds, styleProblem, themedStyle } from "@/lib/map/themes";

function fakeMap() {
  const sources = new Map<string, { data: MapFeatureCollection; setData: (data: MapFeatureCollection) => void }>();
  const layers = new Map<string, object>();
  const paint = new Map<string, unknown>();
  const layout = new Map<string, unknown>();
  const map: OverlayMap = {
    getSource: (id) => sources.get(id),
    addSource: (id, source) => {
      const entry = {
        data: source.data,
        setData: (data: MapFeatureCollection) => {
          entry.data = data;
        },
      };
      sources.set(id, entry);
    },
    getLayer: (id) => layers.get(id),
    addLayer: (layer) => {
      layers.set((layer as { id: string }).id, layer);
    },
    setPaintProperty: (layer, name, value) => {
      paint.set(`${layer}:${name}`, value);
    },
    setLayoutProperty: (layer, name, value) => {
      layout.set(`${layer}:${name}`, value);
    },
  };
  return { map, sources, layers, paint, layout };
}

describe("map style", () => {
  it("builds light and dark MapLibre styles from OpenFreeMap without a paid provider", () => {
    expect(LIBERTY_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(DARK_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/dark");
    for (const theme of ["light", "dark"] as const) {
      const style = themedStyle(theme);
      expect(styleProblem(style)).toBeNull();
      expect(style.version).toBe(8);
      expect(style.sprite).toContain("https://tiles.openfreemap.org/");
      expect(style.glyphs).toContain("https://tiles.openfreemap.org/");
      expect(JSON.stringify(style.sources)).toContain("https://tiles.openfreemap.org/");
      expect(JSON.stringify(style)).not.toContain("mapbox");
      expect(JSON.stringify(style)).not.toContain("access_token");
      const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
      const ids = new Set(style.layers.map((layer) => layer.id));
      for (const id of Object.keys(colors)) expect(ids.has(id)).toBe(true);
      for (const id of layerIds(theme, "labels")) expect(ids.has(id)).toBe(true);
      for (const id of layerIds(theme, "poi")) expect(ids.has(id)).toBe(true);
    }
    const light = themedStyle("light");
    expect(light.layers.find((layer) => layer.id === "water")?.paint?.["fill-color"]).toBe("#7eb4d8");
    const dark = themedStyle("dark");
    expect(dark.layers.find((layer) => layer.id === "highway_motorway_inner")?.paint?.["line-color"]).toBe("#e0b07a");
    expect(styleProblem(null)).toMatch(/not valid JSON/);
  });

  it("drops invalid coordinates and restores markers after a style change", () => {
    expect(normalizeView({ lng: 999, lat: 1, zoom: 4 })).toEqual({ lng: 77.59, lat: 12.97, zoom: 11 });
    expect(normalizeView({ lng: 77.59, lat: 12.97, zoom: 40 }).zoom).toBe(18);
    const points = mapPoints([
      { id: "bengaluru", name: "Bengaluru", lat: 12.97, lng: 77.59, kind: "city" },
      { id: "bad", name: "Bad", lat: 120, lng: 10, kind: "city" },
      { id: "blank", name: "  ", lat: 12, lng: 77, kind: "city" },
      { id: "bengaluru", name: "Again", lat: 12.97, lng: 77.59, kind: "city" },
    ]);
    expect(points.features).toHaveLength(1);
    expect(points.features[0]?.geometry.coordinates).toEqual([77.59, 12.97]);

    const { map, sources, layers, layout } = fakeMap();
    map.addLayer({ id: "place_city" });
    restoreOverlays(map, {
      theme: "dark",
      labels: false,
      pois: true,
      points: [{ id: "bengaluru", name: "Bengaluru", lat: 12.97, lng: 77.59, kind: "city" }],
    });
    expect(sources.has("nagrek-points")).toBe(true);
    expect(layers.has("nagrek-points")).toBe(true);
    expect(layout.get("place_city:visibility")).toBe("none");
    syncPoints(map, [{ id: "mumbai", name: "Mumbai", lat: 19.08, lng: 72.88, kind: "city" }], "light");
    expect(layers.size).toBe(3);
    const data = sources.get("nagrek-points")?.data as { features: { properties: { name: string } }[] };
    expect(data.features[0]?.properties.name).toBe("Mumbai");
    applyGroupVisibility(map, ["missing"], false);
    expect(layout.has("missing:visibility")).toBe(false);
  });
});
