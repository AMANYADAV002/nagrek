'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AmbassadorForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [campus, setCampus] = useState('')
  const [city, setCity] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/ambassador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, campus, city: city || undefined, note: note || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not submit')
      }
      setStatus('done')
      setMessage('Thanks — we will reach out with campus ambassador details.')
      setName('')
      setEmail('')
      setCampus('')
      setCity('')
      setNote('')
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ambassador_apply' }),
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
        className="glass inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-sm"
      >
        <Check className="size-4 text-success" aria-hidden="true" />
        {message}
      </motion.p>
    )
  }

  return (
    <form onSubmit={submit} className="glass flex w-full max-w-xl flex-col gap-3 rounded-3xl p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Name"
          className="h-11"
        />
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@college.edu"
          aria-label="Email"
          className="h-11"
        />
        <Input
          required
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          placeholder="Campus / college"
          aria-label="Campus"
          className="h-11"
        />
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          aria-label="City"
          className="h-11"
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why you? (optional)"
        aria-label="Note"
        className="h-11"
      />
      <Button type="submit" size="md" disabled={status === 'loading'} className="rounded-xl sm:self-start">
        {status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : 'Apply as ambassador'}
      </Button>
      {status === 'error' && <p className="text-xs text-destructive">{message}</p>}
    </form>
  )
}
