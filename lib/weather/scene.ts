export type WeatherScene = "sun" | "cloud" | "rain" | "storm" | "night" | "fog" | "snow";

export const SCENE_LABEL: Record<WeatherScene, string> = {
  sun: "Clear",
  cloud: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  night: "Clear night",
  fog: "Fog",
  snow: "Snow",
};

/** Open-Meteo WMO code plus day/night, mapped to one backdrop. */
export function weatherScene(code: number, isDay: boolean): WeatherScene {
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 3 || (code === 2 && isDay)) return "cloud";
  if (!isDay) return "night";
  return "sun";
}
