'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatCoords, regionFromCoords } from '@/lib/regions'

export type GeoStatus = 'idle' | 'locating' | 'located' | 'denied' | 'unsupported'

/**
 * Detects a coarse region from the browser's geolocation. Coordinates are
 * only used locally to pick a region; they are never sent to the server.
 */
export function useGeoRegion(onRegion: (region: string) => void) {
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [coords, setCoords] = useState<string | null>(null)
  const onRegionRef = useRef(onRegion)
  onRegionRef.current = onRegion

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords(formatCoords(c.latitude, c.longitude))
        onRegionRef.current(regionFromCoords(c.latitude, c.longitude))
        setStatus('located')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  return { status, coords, locate }
}
