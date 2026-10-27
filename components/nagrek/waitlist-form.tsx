'use client'

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function WaitlistForm({
  source = 'landing',
  cityPlaceholder = 'City (optional)',
}: {
  source?: string
  cityPlaceholder?: string
}) {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, city: city || undefined, source }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not join waitlist')
      }
      setStatus('done')
      setMessage('You are on the list. We will email when seats open.')
      setEmail('')
      setCity('')
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'waitlist_join', props: { source } }),
      }).catch(() => {})
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (status === 'done') {
    return (
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm text-foreground"
      >
        <Check className="size-4 text-success" aria-hidden="true" />
        {message}
      </motion.p>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="glass relative flex w-full max-w-lg flex-col gap-2 rounded-2xl p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-2"
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@college.edu"
        aria-label="Email"
        className="h-11 border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:ring-0"
      />
      <Input
        type="text"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder={cityPlaceholder}
        aria-label="City"
        className="h-11 border-0 bg-transparent shadow-none sm:w-36 hover:bg-transparent focus-visible:ring-0"
      />
      <Button type="submit" size="md" disabled={status === 'loading'} className="shrink-0 rounded-xl">
        {status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : 'Join waitlist'}
      </Button>
      {status === 'error' && (
        <p className="absolute -bottom-6 left-2 text-xs text-destructive sm:left-3">{message}</p>
      )}
    </form>
  )
}
