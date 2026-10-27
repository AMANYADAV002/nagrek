import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-foreground shadow-inner shadow-black/20',
      'placeholder:text-muted-foreground/70',
      'transition-[border-color,box-shadow,background-color] duration-200',
      'hover:border-white/15 hover:bg-black/35',
      'focus-visible:border-accent/50 focus-visible:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
