'use client'

import { useEffect } from 'react'

/** Registers the installable shell SW. Push stays disabled until GATE-G7. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
