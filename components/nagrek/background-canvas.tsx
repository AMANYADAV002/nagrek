'use client'

import { useEffect, useRef } from 'react'

/**
 * Lightweight ambient backdrop. Prefer CSS gradients; optional low-cost ember
 * particles (skipped when reduced-motion or when the tab is hidden).
 */
export function BackgroundCanvas({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intensityRef = useRef(intensity)
  intensityRef.current = intensity

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (reduceMotion || !finePointer) return

    let width = 0
    let height = 0
    let raf = 0
    let last = 0
    const TARGET_MS = 1000 / 24 // 24fps max — enough for ambient, cheap on CPU/GPU

    const motes = Array.from({ length: 18 }, () => ({
      x: 0,
      y: 0,
      r: 0.8 + Math.random() * 1.4,
      speed: 0.12 + Math.random() * 0.35,
      drift: Math.random() * Math.PI * 2,
      alpha: 0.12 + Math.random() * 0.35,
    }))

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (const m of motes) {
        m.x = Math.random() * width
        m.y = Math.random() * height
      }
    }
    resize()

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      if (t - last < TARGET_MS) return
      last = t

      const k = intensityRef.current
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      for (const m of motes) {
        m.y -= m.speed
        m.x += Math.sin(t / 1800 + m.drift) * 0.2
        if (m.y < -10) {
          m.y = height + 10
          m.x = Math.random() * width
        }
        ctx.fillStyle = `rgba(255,200,160,${m.alpha * k})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 ambient-bg">
      <canvas ref={canvasRef} className="absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_88%)]" />
    </div>
  )
}
