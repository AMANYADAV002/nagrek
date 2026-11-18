import darkStyle from "./styles/dark.json";
import libertyStyle from "./styles/liberty.json";

/** Public OpenFreeMap styles. No API key. */
export const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
export const MAP_ATTRIBUTION = "© OpenStreetMap contributors · OpenFreeMap";

export type MapTheme = "light" | "dark";

type StyleLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

export type StyleDocument = {
  version: number;
  sources: Record<string, { type?: string; url?: string; tiles?: string[]; attribution?: string }>;
  layers: StyleLayer[];
  sprite?: string;
  glyphs?: string;
};

/**
 * Recolor a layer by editing these maps. Keys are layer ids from the style JSON
 * (open either file in Maputnik). The map swaps styles with setStyle.
 */
export const LIGHT_COLORS: Record<string, string> = {
  background: "#f4f1ea",
  park: "#b7d7a8",
  park_outline: "#8fb57a",
  water: "#7eb4d8",
  waterway_tunnel: "#7eb4d8",
  waterway_river: "#7eb4d8",
  waterway_other: "#7eb4d8",
  building: "#e4dfd6",
  "building-3d": "#dbd5ca",
  road_motorway: "#e3944a",
  road_motorway_link: "#e3944a",
  road_motorway_casing: "#c47832",
  road_motorway_link_casing: "#c47832",
  road_trunk_primary: "#f0d3a0",
  road_trunk_primary_casing: "#d7b27a",
  road_secondary_tertiary: "#ffffff",
  road_secondary_tertiary_casing: "#d9d3c8",
  road_minor: "#ffffff",
  road_minor_casing: "#e4ddd2",
  road_service_track: "#ffffff",
  road_service_track_casing: "#e4ddd2",
  road_link: "#ffffff",
  road_link_casing: "#e4ddd2",
  road_path_pedestrian: "#d7d0c4",
  "highway-name-major": "#4a453f",
  "highway-name-minor": "#6b645c",
  "highway-name-path": "#6b645c",
  label_city: "#3c3834",
  label_city_capital: "#3c3834",
  label_town: "#5c564f",
  label_village: "#6b645c",
  label_state: "#6b645c",
  label_country_1: "#3c3834",
  label_country_2: "#3c3834",
  label_country_3: "#5c564f",
  water_name_point_label: "#2f6078",
  water_name_line_label: "#2f6078",
  waterway_line_label: "#2f6078",
};

export const DARK_COLORS: Record<string, string> = {
  background: "#141210",
  water: "#1a3344",
  waterway: "#1a3344",
  landuse_park: "#24352a",
  building: "#2c2824",
  highway_path: "#3a342f",
  highway_minor: "#4a433c",
  highway_major_casing: "#3a332c",
  highway_major_inner: "#6d6258",
  highway_major_subtle: "#6d6258",
  highway_motorway_casing: "#6b4a2a",
  highway_motorway_inner: "#e0b07a",
  highway_motorway_subtle: "#e0b07a",
  highway_name_other: "#d9d0c6",
  highway_name_motorway: "#f0d7b0",
  water_name: "#9ec4d6",
  place_other: "#c9c0b6",
  place_suburb: "#d4cdc3",
  place_village: "#d4cdc3",
  place_town: "#e6ded4",
  place_city: "#f5f0ea",
  place_city_large: "#f5f0ea",
  place_state: "#d4cdc3",
  place_country_other: "#f5f0ea",
  place_country_minor: "#f5f0ea",
  place_country_major: "#f5f0ea",
};

const LABEL_LAYERS: Record<MapTheme, string[]> = {
  light: [
    "highway-name-path",
    "highway-name-minor",
    "highway-name-major",
    "label_other",
    "label_village",
    "label_town",
    "label_state",
    "label_city",
    "label_city_capital",
    "label_country_3",
    "label_country_2",
    "label_country_1",
    "waterway_line_label",
    "water_name_point_label",
    "water_name_line_label",
  ],
  dark: [
    "water_name",
    "highway_name_other",
    "highway_name_motorway",
    "place_other",
    "place_suburb",
    "place_village",
    "place_town",
    "place_city",
    "place_city_large",
    "place_state",
    "place_country_other",
    "place_country_minor",
    "place_country_major",
  ],
};

const POI_LAYERS: Record<MapTheme, string[]> = {
  light: ["poi_r20", "poi_r7", "poi_r1", "poi_transit"],
  dark: [],
};

const BUILDING_OUTLINE: Record<MapTheme, string> = {
  light: "#d5cfc4",
  dark: "#3a342e",
};

const PAINT_COLOR: Record<string, string> = {
  background: "background-color",
  fill: "fill-color",
  line: "line-color",
  "fill-extrusion": "fill-extrusion-color",
  symbol: "text-color",
};

function cloneStyle(theme: MapTheme): StyleDocument {
  const source = theme === "dark" ? darkStyle : libertyStyle;
  return structuredClone(source) as StyleDocument;
}

export function layerIds(theme: MapTheme, group: "labels" | "poi"): string[] {
  return group === "labels" ? LABEL_LAYERS[theme] : POI_LAYERS[theme];
}

export function styleProblem(style: unknown): string | null {
  if (!style || typeof style !== "object") return "The map style is not valid JSON.";
  const doc = style as Partial<StyleDocument>;
  if (doc.version !== 8) return "The map style is not a MapLibre style.";
  if (!doc.sources || typeof doc.sources !== "object") return "The map style has no tile sources.";
  if (!Array.isArray(doc.layers) || doc.layers.length === 0) return "The map style has no layers.";
  const serialized = JSON.stringify(style);
  if (serialized.includes("mapbox://") || serialized.includes("api.mapbox.com") || serialized.includes("maps.googleapis.com")) {
    return "This map style depends on a paid map service.";
  }
  return null;
}

/** Returns a Maputnik-compatible style with Nagrek colors applied. */
export function themedStyle(theme: MapTheme): StyleDocument {
  const style = cloneStyle(theme);
  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  for (const source of Object.values(style.sources)) {
    if (source && !source.attribution) source.attribution = MAP_ATTRIBUTION;
  }
  for (const layer of style.layers) {
    const color = colors[layer.id];
    const paintKey = PAINT_COLOR[layer.type];
    if (color && paintKey) {
      layer.paint = { ...(layer.paint ?? {}), [paintKey]: color };
    }
    if (layer.id === "building" && layer.type === "fill") {
      layer.paint = { ...(layer.paint ?? {}), "fill-outline-color": BUILDING_OUTLINE[theme] };
    }
  }
  return style;
}
