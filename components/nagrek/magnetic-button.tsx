'use client'

import { motion, useMotionValue, useSpring, type HTMLMotionProps } from 'framer-motion'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'glass' | 'ghost' | 'success' | 'danger'

interface MagneticButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant
  size?: 'md' | 'lg' | 'xl'
  strength?: number
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-sunset text-primary-foreground shadow-[0_10px_40px_-8px_rgba(255,126,95,0.65)] hover:shadow-[0_14px_50px_-6px_rgba(255,126,95,0.8)]',
  glass: 'glass text-foreground hover:bg-glass-strong',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-glass',
  success: 'bg-success text-[#07160d] shadow-[0_10px_40px_-8px_rgba(126,224,168,0.6)]',
  danger: 'glass text-foreground hover:border-destructive/60 hover:text-destructive',
}

const SIZES = {
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-14 px-7 text-base gap-2.5',
  xl: 'h-16 px-9 text-lg gap-3',
}

/** A button that leans toward the pointer and springs back. */
export function MagneticButton({
  variant = 'primary',
  size = 'lg',
  strength = 0.3,
  className,
  children,
  disabled,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 15, mass: 0.3 })
  const sy = useSpring(y, { stiffness: 220, damping: 15, mass: 0.3 })

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || disabled) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength)
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      data-cursor="hover"
      disabled={disabled}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cn(
        'relative inline-flex select-none items-center justify-center rounded-full font-medium tracking-tight transition-[background-color,box-shadow,color,border-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
