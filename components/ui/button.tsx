'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-sunset text-primary-foreground shadow-[0_12px_40px_-12px_rgba(255,126,95,0.7)] hover:brightness-105',
  secondary: 'glass-soft text-foreground hover:bg-white/10',
  ghost: 'text-muted-foreground hover:bg-white/8 hover:text-foreground',
  outline: 'border border-white/15 bg-transparent hover:border-white/25 hover:bg-white/5',
  destructive: 'border border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'size-10',
}

/** shadcn / 21st.dev–compatible button with subtle press motion. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', disabled, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  ),
)
Button.displayName = 'Button'
