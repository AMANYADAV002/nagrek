/** Coarse ~10 km grid cell. Never send raw coordinates to partners. */
export function locationCellFromCoords(lat: number, lon: number): string {
  return `${roundTenths(lat)},${roundTenths(lon)}`
}

function roundTenths(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}

export const LOCATION_CELL_PATTERN = /^-?\d{1,3}\.\d,-?\d{1,3}\.\d$/
