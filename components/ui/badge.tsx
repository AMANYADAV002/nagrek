import * as React from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default: 'border-white/10 bg-white/5 text-muted-foreground',
  sunset: 'border-primary/25 bg-primary/10 text-accent',
  success: 'border-success/25 bg-success/10 text-success',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
} as const

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em]',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
