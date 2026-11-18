"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Chip } from "@/components/glass/chip";
import {
  POINTS_LAYER,
  restoreOverlays,
  type MapFeatureCollection,
  type MapPoint,
  type MapView,
  type OverlayMap,
  normalizeView,
} from "@/lib/map/overlay";
import { MAP_ATTRIBUTION, styleProblem, themedStyle, type MapTheme } from "@/lib/map/themes";
import { roundCoord } from "@/lib/validation/onboarding";

function webgl2Available() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function asOverlay(map: MapLibreMap): OverlayMap {
  return {
    getSource: (id) => {
      const source = map.getSource(id);
      if (source?.type !== "geojson") return undefined;
      return source as unknown as { setData: (data: MapFeatureCollection) => void };
    },
    addSource: (id, source) => {
      map.addSource(id, source);
    },
    getLayer: (id) => map.getLayer(id),
    addLayer: (layer) => {
      map.addLayer(layer as Parameters<MapLibreMap["addLayer"]>[0]);
    },
    setPaintProperty: (layer, name, value) => {
      map.setPaintProperty(layer, name as "circle-color", value as string);
    },
    setLayoutProperty: (layer, _name, value) => {
      map.setLayoutProperty(layer, "visibility", value === "none" ? "none" : "visible");
    },
  };
}

export function PlaceMap({ view, points }: { view: MapView; points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const themeRef = useRef<MapTheme>("dark");
  const pointsRef = useRef<MapPoint[]>(points);
  const labelsRef = useRef(true);
  const poisRef = useRef(true);
  const viewRef = useRef(view);
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [labels, setLabels] = useState(true);
  const [pois, setPois] = useState(true);
  const [ready, setReady] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tileWarning, setTileWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [you, setYou] = useState<MapPoint | null>(null);
  const shown = useMemo(() => (you ? [...points, you] : points), [points, you]);

  useEffect(() => {
    pointsRef.current = shown;
    viewRef.current = view;
    themeRef.current = theme;
    labelsRef.current = labels;
    poisRef.current = pois;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let detachOffline = () => {};

    void (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled) return;
        maplibregl.setWorkerUrl(`${window.location.origin}/maplibre-gl-worker?v=2`);
        if (!webgl2Available()) {
          setFault("This browser cannot draw the map because WebGL is unavailable.");
          return;
        }
        const style = themedStyle(themeRef.current);
        const problem = styleProblem(style);
        if (problem) {
          setFault(problem);
          return;
        }
        container.replaceChildren();
        const camera = normalizeView(viewRef.current);
        const map = new maplibregl.Map({
          container,
          style: style as unknown as StyleSpecification,
          center: [camera.lng, camera.lat],
          zoom: camera.zoom,
          minZoom: 2,
          maxZoom: 18,
          maxPitch: 60,
          cooperativeGestures: true,
          attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
          maplibreLogo: false,
          canvasContextAttributes: { antialias: true, failIfMajorPerformanceCaveat: false },
        });
        if (cancelled) {
          map.remove();
          return;
        }
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");
        mapRef.current = map;

        map.on("error", (event) => {
          if (cancelled) return;
          const faultEvent = event as { sourceId?: string; tile?: unknown; error?: { message?: string } };
          if (faultEvent.sourceId || faultEvent.tile) {
            setTileWarning("Some map tiles did not load. Move the map to try again.");
            return;
          }
          if (!map.isStyleLoaded()) setFault("The map could not be loaded. Check your connection and try again.");
        });
        map.on("webglcontextlost", () => {
          if (!cancelled) setFault("The map stopped because WebGL was interrupted. Try again.");
        });
        let bound = false;
        map.on("style.load", () => {
          if (cancelled || mapRef.current !== map) return;
          restoreOverlays(asOverlay(map), {
            theme: themeRef.current,
            points: pointsRef.current,
            labels: labelsRef.current,
            pois: poisRef.current,
          });
          setReady(true);
          setFault(null);
          map.resize();
          if (bound) return;
          bound = true;
          map.on("click", POINTS_LAYER, (event) => {
            const feature = event.features?.[0];
            const name = feature?.properties?.name;
            const geometry = feature?.geometry;
            if (typeof name !== "string" || !geometry || geometry.type !== "Point") return;
            const [lng, lat] = geometry.coordinates;
            if (typeof lng !== "number" || typeof lat !== "number") return;
            new maplibregl.Popup({ closeButton: true, maxWidth: "220px" }).setLngLat([lng, lat]).setText(name).addTo(map);
          });
          map.on("mouseenter", POINTS_LAYER, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", POINTS_LAYER, () => {
            map.getCanvas().style.cursor = "";
          });
        });

        observer = new ResizeObserver(() => {
          if (mapRef.current === map) map.resize();
        });
        observer.observe(container);
        const onOffline = () => {
          if (!cancelled) setNotice("You are offline. Tiles will load when the connection returns.");
        };
        window.addEventListener("offline", onOffline);
        detachOffline = () => window.removeEventListener("offline", onOffline);
      } catch {
        if (!cancelled) setFault("The map could not be started.");
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      detachOffline();
      const current = mapRef.current;
      mapRef.current = null;
      current?.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.isStyleLoaded()) return;
    restoreOverlays(asOverlay(map), { theme, points: shown, labels, pois });
  }, [ready, theme, shown, labels, pois]);

  const { lng, lat, zoom } = view;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const camera = normalizeView({ lng, lat, zoom });
    const center = map.getCenter();
    if (Math.abs(center.lng - camera.lng) < 0.02 && Math.abs(center.lat - camera.lat) < 0.02 && Math.abs(map.getZoom() - camera.zoom) < 0.25) return;
    map.flyTo({ center: [camera.lng, camera.lat], zoom: camera.zoom, essential: true, duration: 700 });
  }, [ready, lng, lat, zoom]);

  function chooseTheme(next: MapTheme) {
    if (next === themeRef.current) return;
    themeRef.current = next;
    setTheme(next);
    const map = mapRef.current;
    if (!map) return;
    const style = themedStyle(next);
    const problem = styleProblem(style);
    if (problem) {
      setFault(problem);
      return;
    }
    setFault(null);
    map.setStyle(style as unknown as StyleSpecification, { diff: false });
  }

  function locate() {
    if (!navigator.geolocation) {
      setNotice("This browser has no location. The map is still available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setNotice("That location could not be used.");
          return;
        }
        setNotice(null);
        setYou({ id: "you", name: "Near you", lat, lng, kind: "you" });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, essential: true });
      },
      () => setNotice("Location is off. The map is still available."),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  }

  return (
    <section aria-label="City map" className="relative h-[min(70vh,32rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#141210]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 pr-14">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Chip className="px-3 py-1 text-xs" selected={theme === "light"} showCheck={false} onClick={() => chooseTheme("light")}>Light</Chip>
          <Chip className="px-3 py-1 text-xs" selected={theme === "dark"} showCheck={false} onClick={() => chooseTheme("dark")}>Dark</Chip>
          <Chip className="px-3 py-1 text-xs" selected={labels} showCheck={false} onClick={() => setLabels((on) => !on)}>Labels</Chip>
          <Chip className="px-3 py-1 text-xs" selected={pois} showCheck={false} onClick={() => setPois((on) => !on)}>Places</Chip>
          <Chip className="px-3 py-1 text-xs" selected={false} showCheck={false} onClick={locate}>Near me</Chip>
        </div>
      </div>
      {(notice || tileWarning) && !fault && (
        <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
          {notice && <p role="status" className="max-w-sm rounded-xl bg-black/75 px-3 py-2 text-xs text-cream">{notice}</p>}
          {tileWarning && <p role="status" className="max-w-sm rounded-xl bg-black/75 px-3 py-2 text-xs text-cream">{tileWarning}</p>}
        </div>
      )}
      {fault && (
        <div role="alert" className="absolute inset-0 z-20 grid place-items-center bg-[#141210]/95 p-6 text-center">
          <div className="max-w-sm space-y-3">
            <p className="text-sm text-cream">{fault}</p>
            <button
              type="button"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-ink"
              onClick={() => {
                setFault(null);
                setTileWarning(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
