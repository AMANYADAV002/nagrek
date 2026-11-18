"use client";

import { useEffect, useState } from "react";
import { loadLocalWeather, WEATHER_PENDING, type LocalWeather } from "@/lib/weather/load";

/** Live sky for the signed-in area. A fresh cache paints without another request. */
export function useLocalWeather(city?: string, lat?: number, lng?: number) {
  const [weather, setWeather] = useState<LocalWeather>(WEATHER_PENDING);

  useEffect(() => {
    let cancelled = false;
    void loadLocalWeather({ city, lat, lng }).then((next) => {
      if (!cancelled) setWeather(next);
    });
    return () => {
      cancelled = true;
    };
  }, [city, lat, lng]);

  return weather;
}
