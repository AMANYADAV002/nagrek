'use client'

import gsap from 'gsap'
import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface SplitRevealProps {
  text: string
  className?: string
  delay?: number
  /** Element tag; defaults to span so it can live inside headings. */
  as?: 'span' | 'h1' | 'h2' | 'p'
}

/**
 * Character-split GSAP reveal: letters rise out of a mask with a blur.
 * The full string stays available to screen readers via aria-label.
 */
export function SplitReveal({ text, className, delay = 0, as: Tag = 'span' }: SplitRevealProps) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const chars = el.querySelectorAll<HTMLElement>('[data-char]')
    if (reduce) {
      gsap.set(chars, { yPercent: 0, opacity: 1, filter: 'blur(0px)' })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { yPercent: 115, opacity: 0, rotateX: -70, filter: 'blur(8px)' },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          filter: 'blur(0px)',
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.035,
          delay,
        },
      )
    }, el)
    return () => ctx.revert()
  }, [text, delay])

  const words = text.split(' ')

  return (
    <Tag ref={ref as never} aria-label={text} className={cn('inline-block [perspective:800px]', className)}>
      {words.map((word, wi) => (
        <span key={`${word}-${wi}`} aria-hidden="true" className="inline-block whitespace-nowrap">
          {Array.from(word).map((char, ci) => (
            <span key={ci} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span data-char className="inline-block will-change-transform" style={{ opacity: 0 }}>
                {char}
              </span>
            </span>
          ))}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  )
}
