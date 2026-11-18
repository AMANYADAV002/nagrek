import { cities, nearestCity } from "@/lib/data/cities";
import { haversineKm } from "@/lib/matching/score";
import { roundCoord } from "@/lib/validation/onboarding";
import { SCENE_LABEL, weatherScene, type WeatherScene } from "@/lib/weather/scene";

const CACHE_KEY = "nagrek.weather.v1";
export const WEATHER_CACHE_MS = 20 * 60 * 1000;
const BENGALURU = { lat: 12.97, lng: 77.59, place: "Bengaluru" };

export interface LocalWeather {
  scene: WeatherScene;
  label: string;
  place: string;
  at: number;
}

export const WEATHER_PENDING: LocalWeather = { scene: "sun", label: "Local weather", place: "Nearby", at: 0 };

interface Point {
  lat: number;
  lng: number;
  place?: string;
}

export function readWeatherCache(now = Date.now()): LocalWeather | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as LocalWeather;
    if (!saved?.scene || !SCENE_LABEL[saved.scene] || now - saved.at > WEATHER_CACHE_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

function remember(weather: LocalWeather) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(weather));
  } catch {
    /* private mode can refuse storage; the sky still updates this visit */
  }
}

function locate(): Promise<Point | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: WEATHER_CACHE_MS },
    );
  });
}

async function ipPoint(): Promise<Point | null> {
  try {
    const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
    if (!res.ok) return null;
    const data = (await res.json()) as { latitude?: string; longitude?: string; city?: string };
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: roundCoord(lat), lng: roundCoord(lng), place: data.city };
  } catch {
    return null;
  }
}

function cityPoint(name?: string): Point | null {
  if (!name) return null;
  const found = cities.find((city) => city.name.toLowerCase() === name.toLowerCase());
  if (!found) return null;
  return { lat: found.point.lat, lng: found.point.lng, place: found.name };
}

async function forecast(point: Point): Promise<LocalWeather> {
  const near = nearestCity(point);
  const place = haversineKm(point, near.point) < 80 ? near.name : point.place || "Your area";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lng}&current=weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather");
  const data = (await res.json()) as { current?: { weather_code?: number; is_day?: number } };
  const code = data.current?.weather_code ?? 0;
  const scene = weatherScene(code, data.current?.is_day !== 0);
  const weather = { scene, label: SCENE_LABEL[scene], place, at: Date.now() };
  remember(weather);
  return weather;
}

/** One sky reading, reused for 20 minutes. Coordinates are rounded to about a kilometre. */
export async function loadLocalWeather(fallback?: { city?: string; lat?: number; lng?: number }): Promise<LocalWeather> {
  const cached = readWeatherCache();
  if (cached) return cached;
  const gps = await locate();
  const saved = Number.isFinite(fallback?.lat) && Number.isFinite(fallback?.lng)
    ? { lat: roundCoord(fallback!.lat!), lng: roundCoord(fallback!.lng!), place: fallback?.city }
    : null;
  const point = gps ?? (await ipPoint()) ?? saved ?? cityPoint(fallback?.city) ?? BENGALURU;
  try {
    return await forecast(point);
  } catch {
    const hour = new Date().getHours();
    const scene = weatherScene(0, hour >= 6 && hour < 19);
    return { scene, label: SCENE_LABEL[scene], place: point.place || "Bengaluru", at: Date.now() };
  }
}
