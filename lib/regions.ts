/**
 * Coarse, privacy-friendly regions. Exact coordinates never leave the
 * browser — only the region name is sent to the server for matching.
 */
export const GLOBAL_REGION = 'Global'

interface RegionBox {
  name: string
  lat: [number, number]
  lon: [number, number]
}

/** Checked in order; first match wins, so specific boxes come first. */
const REGION_BOXES: RegionBox[] = [
  { name: 'South Asia', lat: [5, 37], lon: [60, 92] },
  { name: 'Middle East', lat: [12, 42], lon: [34, 60] },
  { name: 'Southeast Asia', lat: [-11, 24], lon: [92, 141] },
  { name: 'East Asia', lat: [18, 54], lon: [100, 146] },
  { name: 'Europe — West', lat: [35, 72], lon: [-25, 15] },
  { name: 'Europe — East', lat: [35, 72], lon: [15, 45] },
  { name: 'Africa', lat: [-35, 37], lon: [-18, 52] },
  { name: 'Oceania', lat: [-50, -10], lon: [110, 180] },
  { name: 'North America — West', lat: [15, 72], lon: [-170, -100] },
  { name: 'North America — East', lat: [15, 72], lon: [-100, -50] },
  { name: 'South America', lat: [-56, 15], lon: [-82, -34] },
  { name: 'Central Asia', lat: [35, 56], lon: [45, 90] },
]

export const REGIONS: string[] = [GLOBAL_REGION, ...REGION_BOXES.map((r) => r.name).sort()]

export function regionFromCoords(lat: number, lon: number): string {
  const box = REGION_BOXES.find(
    (r) => lat >= r.lat[0] && lat <= r.lat[1] && lon >= r.lon[0] && lon <= r.lon[1],
  )
  return box?.name ?? GLOBAL_REGION
}

/** Display coordinates rounded to ~10km so the UI looks precise without leaking precision. */
export function formatCoords(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`
}
