'use client'

import { motion } from 'framer-motion'
import { AlertCircle, Check, ChevronRight, Loader2, ShieldCheck, Sparkles, User } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fadeScale } from '@/lib/motion'
import { cn } from '@/lib/utils'

const AVATAR_PRESETS = [
  '/images/food-pizza.webp',
  '/images/food-burger.webp',
  '/images/food-sushi.webp',
  '/images/food-coffee.webp',
]

interface ProfileSetupScreenProps {
  defaultName?: string
  defaultUsername?: string
  onComplete: (data: {
    username: string
    displayName: string
    avatarUrl: string | null
    ageConfirmed: boolean
    instagram: string | null
    snapchat: string | null
    facebook: string | null
    linkedin: string | null
  }) => Promise<void>
}

export function ProfileSetupScreen({ defaultName = '', defaultUsername = '', onComplete }: ProfileSetupScreenProps) {
  const [displayName, setDisplayName] = useState(defaultName)
  const [username, setUsername] = useState(
    defaultUsername || defaultName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
  )
  const [avatarUrl, setAvatarUrl] = useState<string | null>(AVATAR_PRESETS[0])
  const [instagram, setInstagram] = useState('')
  const [snapchat, setSnapchat] = useState('')
  const [facebook, setFacebook] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = ageConfirmed && displayName.trim().length >= 2 && username.trim().length >= 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ageConfirmed) {
      setError('You must confirm you are 18 or older to use Nagrek.')
      return
    }
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 alphanumeric characters.')
      return
    }
    const cleanDisplay = displayName.trim()
    if (cleanDisplay.length < 2) {
      setError('Display name must be at least 2 characters.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onComplete({
        username: cleanUsername,
        displayName: cleanDisplay,
        avatarUrl,
        ageConfirmed: true,
        instagram: instagram.trim().replace(/^@/, '') || null,
        snapchat: snapchat.trim().replace(/^@/, '') || null,
        facebook: facebook.trim().replace(/^@/, '') || null,
        linkedin: linkedin.trim().replace(/^@/, '') || null,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile. Try another username.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.section
      aria-labelledby="onboarding-title"
      className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-20 md:px-8"
      variants={fadeScale}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <div className="relative w-full max-w-md">
        <Card>
          <CardContent className="pt-8">
            <div className="mb-6 text-center">
              <Badge variant="sunset" className="mb-3 normal-case tracking-[0.12em]">
                <Sparkles className="size-3" /> Profile
              </Badge>
              <h2 id="onboarding-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
                Create your <span className="font-serif italic text-sunset">profile</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">How you appear to dining partners.</p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label>Avatar</Label>
                <div className="mt-2 flex items-center justify-center gap-3">
                  {AVATAR_PRESETS.map((preset) => {
                    const selected = avatarUrl === preset
                    return (
                      <motion.button
                        key={preset}
                        type="button"
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setAvatarUrl(preset)}
                        className={cn(
                          'relative size-14 overflow-hidden rounded-full border-2 transition',
                          selected ? 'border-accent ring-2 ring-accent/40' : 'border-white/10 opacity-70',
                        )}
                      >
                        <Image src={preset} alt="" fill sizes="56px" className="object-cover" />
                        {selected && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <Check className="size-4 text-white" />
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="display-name">Display name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Maya"
                    maxLength={40}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="maya_foodie"
                    maxLength={24}
                    required
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-medium text-foreground">Social handles (optional)</p>
                <p className="text-[11px] text-muted-foreground">
                  Shared only with friends after both of you accept — so you can stay in touch on Insta / Snap / FB /
                  LinkedIn.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="Instagram"
                    aria-label="Instagram"
                    maxLength={80}
                  />
                  <Input
                    value={snapchat}
                    onChange={(e) => setSnapchat(e.target.value)}
                    placeholder="Snapchat"
                    aria-label="Snapchat"
                    maxLength={80}
                  />
                  <Input
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="Facebook"
                    aria-label="Facebook"
                    maxLength={120}
                  />
                  <Input
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="LinkedIn"
                    aria-label="LinkedIn"
                    maxLength={120}
                  />
                </div>
              </div>

              <label className="glass-soft flex cursor-pointer items-start gap-3 rounded-2xl p-4">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => {
                    setAgeConfirmed(e.target.checked)
                    if (e.target.checked) setError(null)
                  }}
                  className="mt-1 size-4 rounded border-white/20 bg-black/40 accent-[var(--primary)]"
                />
                <div className="text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck className="size-3.5 text-accent" /> 18+ confirmation
                  </span>
                  <p className="mt-1 text-muted-foreground">I confirm I am at least 18. Nagrek is adults only.</p>
                </div>
              </label>

              <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Continue <ChevronRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.section>
  )
}
