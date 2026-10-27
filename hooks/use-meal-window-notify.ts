'use client'

import { useCallback, useEffect, useState } from 'react'
import { nextMealWindow, type MealWindow } from '@/lib/meal-windows'

const STORAGE_KEY = 'nagrek_meal_notify'

type Stored = { windowId: MealWindow['id']; at: number }

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Stored
  } catch {
    return null
  }
}

function writeStored(value: Stored | null) {
  try {
    if (!value) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/**
 * Local meal-window reminder (browser Notification API).
 * Not server push — GATE-G7 still required before real web push to users.
 */
export function useMealWindowNotify() {
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
    const stored = readStored()
    setEnabled(Boolean(stored))
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const tick = () => {
      const next = nextMealWindow()
      const stored = readStored()
      if (!stored || stored.windowId !== next.window.id) return
      if (next.minutesUntil > 0) return
      // Window just opened — fire once then clear preference for this cycle
      try {
        new Notification(`Nagrek ${next.window.label} is open`, {
          body: 'Jump in — people are matching over food right now.',
          tag: `nagrek-meal-${next.window.id}`,
        })
      } catch {
        /* ignore */
      }
      writeStored(null)
      setEnabled(false)
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'meal_window_notify_fired', props: { window: next.window.id } }),
      }).catch(() => {})
    }

    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [enabled])

  const enable = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return false
    }
    let perm = Notification.permission
    if (perm === 'default') {
      perm = await Notification.requestPermission()
    }
    setPermission(perm)
    if (perm !== 'granted') return false

    const next = nextMealWindow()
    writeStored({ windowId: next.window.id, at: Date.now() })
    setEnabled(true)
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'meal_window_notify_on', props: { window: next.window.id } }),
    }).catch(() => {})
    return true
  }, [])

  const disable = useCallback(() => {
    writeStored(null)
    setEnabled(false)
  }, [])

  return { enabled, permission, enable, disable }
}
