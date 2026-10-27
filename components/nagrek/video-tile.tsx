'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface VideoTileProps {
  stream: MediaStream | null
  muted?: boolean
  mirrored?: boolean
  blurred?: boolean
  label: string
  className?: string
}

export function VideoTile({ stream, muted = false, mirrored = false, blurred = false, label, className }: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream
    if (stream) el.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className={cn(
        'size-full bg-muted object-cover transition-[filter,transform] duration-700 ease-out',
        mirrored && '-scale-x-100',
        blurred && 'scale-105 blur-2xl brightness-90 saturate-75',
        className,
      )}
    />
  )
}
