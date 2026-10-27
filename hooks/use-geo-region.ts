'use client'

import { useCallback, useRef, useState } from 'react'
import { locationCellFromCoords } from '@/lib/location-cell'
import { formatCoords, regionFromCoords } from '@/lib/regions'

export type GeoStatus = 'idle' | 'needs-consent' | 'locating' | 'located' | 'denied' | 'unsupported'

const CONSENT_KEY = 'nagrek_gps_consent_v1'

/**
 * Detects a coarse region + location cell from geolocation.
 * Coordinates never leave the browser; only region name and cell are exposed to callers.
 */
export function useGeoRegion(
  onRegion: (region: string) => void,
  onCell?: (cell: string | null) => void,
) {
  const [status, setStatus] = useState<GeoStatus>(() => {
    if (typeof window === 'undefined') return 'idle'
    if (!('geolocation' in navigator)) return 'unsupported'
    try {
      return localStorage.getItem(CONSENT_KEY) === '1' ? 'idle' : 'needs-consent'
    } catch {
      return 'needs-consent'
    }
  })
  const [coords, setCoords] = useState<string | null>(null)
  const [cell, setCell] = useState<string | null>(null)
  const onRegionRef = useRef(onRegion)
  const onCellRef = useRef(onCell)
  onRegionRef.current = onRegion
  onCellRef.current = onCell

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      onCellRef.current?.(null)
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const nextCell = locationCellFromCoords(c.latitude, c.longitude)
        setCoords(formatCoords(c.latitude, c.longitude))
        setCell(nextCell)
        onRegionRef.current(regionFromCoords(c.latitude, c.longitude))
        onCellRef.current?.(nextCell)
        setStatus('located')
      },
      () => {
        setStatus('denied')
        setCell(null)
        onCellRef.current?.(null)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  }, [])

  const grantConsent = useCallback(() => {
    try {
      localStorage.setItem(CONSENT_KEY, '1')
    } catch {
      /* ignore */
    }
    locate()
  }, [locate])

  const denyConsent = useCallback(() => {
    try {
      localStorage.setItem(CONSENT_KEY, '0')
    } catch {
      /* ignore */
    }
    setStatus('denied')
    setCell(null)
    onCellRef.current?.(null)
  }, [])

  return { status, coords, cell, locate, grantConsent, denyConsent }
}
