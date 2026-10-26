'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/lib/motion'

const FAQS = [
  {
    q: 'Is Nagrek a real video call?',
    a: 'Yes — when two people are online with the same craving nearby, Nagrek connects a live 1-on-1 WebRTC call. If nobody is around, you can try a clearly labeled Demo partner so you can explore the flow.',
  },
  {
    q: 'Do you show bots as real people?',
    a: 'Never. Demo mode is always marked “Demo”. Simulated partners are for testing the UI only.',
  },
  {
    q: 'What location data do you collect?',
    a: 'With your consent we store a coarse location cell (~10 km square), never exact GPS coordinates, and never share your exact position with a partner.',
  },
  {
    q: 'Who can use Nagrek?',
    a: 'Adults 18+ only. You confirm age during profile setup before joining the queue.',
  },
  {
    q: 'Can I report or block someone?',
    a: 'Yes. Report and Block are available during every call. Blocked people will not be matched with you again.',
  },
  {
    q: 'Do you record calls?',
    a: 'No. Video stays peer-to-peer between browsers. The other person could still screen-record on their device — treat calls like any face-to-face chat.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <motion.section
      aria-labelledby="faq-title"
      className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 md:px-10"
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      <h2 id="faq-title" className="mb-8 text-center text-3xl font-semibold tracking-tight md:text-4xl">
        Questions, <span className="font-serif italic text-sunset">answered</span>
      </h2>
      <ul className="space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i
          return (
            <li key={item.q}>
              <motion.div
                layout
                className={cn(
                  'glass overflow-hidden rounded-2xl transition-colors',
                  isOpen && 'border-accent/20',
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium md:text-base"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  {item.q}
                  <ChevronDown
                    className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-300', isOpen && 'rotate-180 text-accent')}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}
