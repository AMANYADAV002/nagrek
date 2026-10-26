'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowUpRight, Crosshair, Loader2, MapPin, Shield } from 'lucide-react'
import Image from 'next/image'
import { useRef } from 'react'
import { useGeoRegion } from '@/hooks/use-geo-region'
import { FOODS, type Food, type FoodId } from '@/lib/foods'
import { currentMealWindow, formatMinutesUntil, nextMealWindow } from '@/lib/meal-windows'
import { REGIONS } from '@/lib/regions'
import { cn } from '@/lib/utils'
import { MagneticButton } from './magnetic-button'

interface CravingScreenProps {
  region: string
  onRegionChange: (region: string) => void
  onCellChange?: (cell: string | null) => void
  onSelect: (food: FoodId) => void
  queueWaiting?: number
}

export function CravingScreen({
  region,
  onRegionChange,
  onCellChange,
  onSelect,
  queueWaiting = 0,
}: CravingScreenProps) {
  const geo = useGeoRegion(onRegionChange, onCellChange)
  const activeWindow = currentMealWindow()
  const next = nextMealWindow()

  return (
    <motion.section
      key="select"
      aria-labelledby="craving-title"
      className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 pb-12 pt-28 md:px-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="glass rounded-full px-3 py-1.5">
          {queueWaiting > 0 ? `${queueWaiting} waiting now` : 'Queue quiet — lunch & dinner windows work best'}
        </span>
        {activeWindow ? (
          <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-success">
            {activeWindow.label} window open (IST)
          </span>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            Next: {next.window.label} in {formatMinutesUntil(next.minutesUntil)} IST
          </span>
        )}
      </div>

      {geo.status === 'needs-consent' && (
        <div className="glass mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Shield className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium">Share a coarse location cell?</p>
              <p className="text-xs text-muted-foreground">
                We store a ~10 km square only — never exact GPS — to match nearby foodies. You can pick a region manually
                instead.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <MagneticButton size="md" variant="glass" onClick={geo.denyConsent}>
              Not now
            </MagneticButton>
            <MagneticButton size="md" onClick={geo.grantConsent}>
              Allow location
            </MagneticButton>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-6 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-accent"
          >
            Step 01 / 03
          </motion.p>
          <motion.h2
            id="craving-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-balance text-5xl font-semibold leading-[0.95] tracking-[-0.04em] md:text-7xl"
          >
            What are you <span className="font-serif font-normal italic text-sunset">craving?</span>
          </motion.h2>
        </div>

        <RegionPanel
          region={region}
          onRegionChange={onRegionChange}
          status={geo.status}
          coords={geo.coords}
          onLocate={geo.status === 'needs-consent' ? geo.grantConsent : geo.locate}
        />
      </div>

      <ul
        className="grid flex-1 auto-rows-[minmax(140px,1fr)] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
        role="list"
      >
        {FOODS.map((food, i) => (
          <li
            key={food.id}
            className={cn(
              i === 0 ? 'col-span-2 row-span-2 min-h-[220px]' : 'col-span-1 min-h-[140px]',
              food.span,
            )}
          >
            <FoodCard food={food} index={i} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </motion.section>
  )
}

function RegionPanel({
  region,
  onRegionChange,
  status,
  coords,
  onLocate,
}: {
  region: string
  onRegionChange: (r: string) => void
  status: ReturnType<typeof useGeoRegion>['status']
  coords: string | null
  onLocate: () => void
}) {
  const helper =
    status === 'needs-consent'
      ? 'Tap detect for nearby matching'
      : status === 'locating'
        ? 'Detecting your area…'
        : status === 'located'
          ? coords
          : status === 'denied'
            ? 'Location blocked — pick manually'
            : status === 'unsupported'
              ? 'Location unavailable — pick manually'
              : 'Region'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass flex items-center gap-3 rounded-2xl p-2 pl-4 md:min-w-80"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {status === 'locating' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <MapPin className="size-4" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground" aria-live="polite">
          {helper}
        </p>
        <label htmlFor="region-select" className="sr-only">
          Matching region
        </label>
        <select
          id="region-select"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          className="w-full cursor-pointer appearance-none truncate bg-transparent text-base font-medium text-foreground focus:outline-none"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r} className="bg-muted text-foreground">
              {r}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onLocate}
        aria-label="Detect my location"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-glass-strong hover:text-foreground"
      >
        <Crosshair className="size-4" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

function FoodCard({ food, index, onSelect }: { food: Food; index: number; onSelect: (id: FoodId) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), { stiffness: 200, damping: 20 })
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), { stiffness: 200, damping: 20 })
  const glareX = useTransform(px, (v) => `${v * 100}%`)
  const glareY = useTransform(py, (v) => `${v * 100}%`)
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,220,190,0.22), transparent 55%)`,
  )
  const Icon = food.icon

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    px.set((e.clientX - rect.left) / rect.width)
    py.set((e.clientY - rect.top) / rect.height)
  }
  const reset = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      data-cursor="hover"
      onClick={() => onSelect(food.id)}
      onPointerMove={onMove}
      onPointerLeave={reset}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.04, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className="group relative block size-full min-h-36 overflow-hidden rounded-3xl border border-white/10 text-left focus-visible:outline-2 focus-visible:outline-offset-4"
      aria-label={`${food.label} — ${food.tagline}`}
    >
      <motion.div layoutId={`food-${food.id}`} className="absolute inset-0 overflow-hidden rounded-3xl">
        <Image
          src={food.image || '/placeholder.svg'}
          alt=""
          fill
          sizes="(min-width: 768px) 25vw, 50vw"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
          priority={index < 2}
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden="true" />
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glare }}
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 md:p-5">
        <div className="min-w-0">
          <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
            <Icon className="size-4 text-accent" aria-hidden="true" />
          </span>
          <p className={cn('font-semibold leading-none tracking-tight', index === 0 ? 'text-3xl md:text-5xl' : 'text-xl md:text-2xl')}>
            {food.label}
          </p>
          <p className="mt-1.5 hidden truncate text-sm text-white/70 sm:block">{food.tagline}</p>
        </div>
        <span className="flex size-9 shrink-0 translate-y-2 items-center justify-center rounded-full bg-sunset text-primary-foreground opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </motion.button>
  )
}
