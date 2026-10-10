'use client'

import { useEffect, useRef } from 'react'

interface Orb {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  hue: string
  depth: number
}

interface Mote {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  alpha: number
}

const ORB_COLORS = ['255,126,95', '254,180,123', '255,94,120', '120,80,200']

/** Full-screen ambient canvas: drifting warm glows, rising embers, subtle pointer parallax. */
export function BackgroundCanvas({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intensityRef = useRef(intensity)
  intensityRef.current = intensity

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let raf = 0
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const orbs: Orb[] = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.max(width, height) * (0.22 + Math.random() * 0.18),
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      hue: ORB_COLORS[i % ORB_COLORS.length],
      depth: 0.3 + Math.random() * 0.7,
    }))

    const moteCount = width < 640 ? 36 : 70
    const motes: Mote[] = Array.from({ length: moteCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.6 + Math.random() * 1.6,
      speed: 0.15 + Math.random() * 0.45,
      drift: Math.random() * Math.PI * 2,
      alpha: 0.15 + Math.random() * 0.5,
    }))

    const draw = (t: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.04
      pointer.y += (pointer.ty - pointer.y) * 0.04
      const px = (pointer.x - 0.5) * 60
      const py = (pointer.y - 0.5) * 60
      const k = intensityRef.current

      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      for (const orb of orbs) {
        orb.x += orb.vx
        orb.y += orb.vy
        if (orb.x < -orb.r * 0.3 || orb.x > width + orb.r * 0.3) orb.vx *= -1
        if (orb.y < -orb.r * 0.3 || orb.y > height + orb.r * 0.3) orb.vy *= -1
        const x = orb.x + px * orb.depth
        const y = orb.y + py * orb.depth
        const g = ctx.createRadialGradient(x, y, 0, x, y, orb.r)
        g.addColorStop(0, `rgba(${orb.hue},${0.16 * k})`)
        g.addColorStop(1, `rgba(${orb.hue},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, orb.r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const m of motes) {
        m.y -= m.speed
        m.x += Math.sin(t / 1600 + m.drift) * 0.25
        if (m.y < -10) {
          m.y = height + 10
          m.x = Math.random() * width
        }
        ctx.fillStyle = `rgba(255,200,160,${m.alpha * k})`
        ctx.beginPath()
        ctx.arc(m.x + px * 0.2, m.y + py * 0.2, m.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      if (!reduceMotion) raf = requestAnimationFrame(draw)
    }

    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX / width
      pointer.ty = e.clientY / height
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduceMotion) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 grain">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_85%)]" />
    </div>
  )
}
