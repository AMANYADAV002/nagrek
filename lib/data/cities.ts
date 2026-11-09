import type { GeoPoint } from "@/lib/types";
import { haversineKm } from "@/lib/matching/score";

/**
 * Offline city lookup used as a stand-in for reverse geocoding.
 * TODO(phase-2): call a reverse-geocoding API server-side for city + area.
 */
export const cities: { name: string; point: GeoPoint }[] = [
  { name: "Bengaluru", point: { lat: 12.97, lng: 77.59 } },
  { name: "Mumbai", point: { lat: 19.08, lng: 72.88 } },
  { name: "Delhi", point: { lat: 28.61, lng: 77.21 } },
  { name: "Hyderabad", point: { lat: 17.39, lng: 78.49 } },
  { name: "Chennai", point: { lat: 13.08, lng: 80.27 } },
  { name: "Pune", point: { lat: 18.52, lng: 73.86 } },
  { name: "Kolkata", point: { lat: 22.57, lng: 88.36 } },
  { name: "Ahmedabad", point: { lat: 23.02, lng: 72.57 } },
  { name: "Jaipur", point: { lat: 26.91, lng: 75.79 } },
  { name: "Lucknow", point: { lat: 26.85, lng: 80.95 } },
  { name: "Gurugram", point: { lat: 28.46, lng: 77.03 } },
  { name: "Goa", point: { lat: 15.5, lng: 73.83 } },
  { name: "Kochi", point: { lat: 9.93, lng: 76.27 } },
  { name: "Chandigarh", point: { lat: 30.73, lng: 76.78 } },
];

export function nearestCity(p: GeoPoint) {
  return cities.reduce((best, c) => (haversineKm(p, c.point) < haversineKm(p, best.point) ? c : best), cities[0]);
}
