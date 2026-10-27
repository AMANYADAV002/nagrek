'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { CreditCard, LogOut, MapPin, User as UserIcon, Users } from 'lucide-react'
import type { Mode, Stage } from '@/hooks/use-nagrek-session'

interface SiteHeaderProps {
  stage: Stage
  mode: Mode
  region: string
  socketConnected: boolean
  displayName?: string
  avatarUrl?: string | null
  queueWaiting?: number
  onlineCount?: number
  onHome: () => void
  onSignOut?: () => void
  onSignIn?: () => void
  onOpenAccount?: () => void
  onOpenFriends?: () => void
}

export function SiteHeader({
  stage,
  mode,
  region,
  socketConnected,
  displayName,
  avatarUrl,
  queueWaiting = 0,
  onlineCount = 0,
  onHome,
  onSignOut,
  onSignIn,
  onOpenAccount,
  onOpenFriends,
}: SiteHeaderProps) {
  const showStatus = stage === 'matching' || stage === 'video'
  const live = mode === 'live' && socketConnected
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 pt-5 md:px-10"
      style={mounted ? { paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))' } : undefined}
    >
      <button
        type="button"
        onClick={onHome}
        className="group flex items-center gap-2.5 rounded-full py-1 pr-2 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4"
        aria-label="Nagrek — back to start"
      >
        <span className="relative flex h-7 w-11 items-center" aria-hidden="true">
          <span className="absolute left-0 size-7 rounded-full border-[2.5px] border-primary transition-transform duration-500 group-hover:-translate-x-0.5" />
          <span className="absolute right-0 size-7 rounded-full border-[2.5px] border-accent transition-transform duration-500 group-hover:translate-x-0.5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          nag<span className="font-serif italic text-sunset">rek</span>
        </span>
      </button>

      <div className="flex items-center gap-3">
        {stage === 'select' || stage === 'matching' || stage === 'hero' ? (
          <span className="glass hidden items-center rounded-full px-3 py-1.5 text-[11px] text-muted-foreground sm:inline-flex">
            {onlineCount > 0 ? `${onlineCount} live · ` : ''}
            {queueWaiting} waiting
          </span>
        ) : null}
        {onOpenFriends && displayName && (
          <button
            type="button"
            onClick={onOpenFriends}
            className="glass hidden size-9 items-center justify-center rounded-full sm:flex"
            aria-label="Friends"
          >
            <Users className="size-4" />
          </button>
        )}
        <AnimatePresence>
          {showStatus && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="glass flex items-center gap-3 rounded-full px-4 py-2 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span
                    className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${live ? 'bg-success' : 'bg-accent'}`}
                  />
                  <span className={`relative inline-flex size-2 rounded-full ${live ? 'bg-success' : 'bg-accent'}`} />
                </span>
                <span className="font-medium uppercase tracking-[0.14em]">
                  {mode === 'demo' ? 'Demo' : live ? 'Live' : 'Connecting'}
                </span>
              </span>
              <span className="h-3 w-px bg-border" aria-hidden="true" />
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" />
                {region}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Account / Sign In */}
        {displayName ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
              data-cursor="hover"
              className="relative flex size-9 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-sunset text-xs font-bold text-primary-foreground shadow-md transition-transform hover:scale-105"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="36px" className="object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="glass absolute right-0 top-12 z-50 min-w-44 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-2xl backdrop-blur-2xl"
                >
                  <div className="border-b border-white/10 px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground">Signed in</p>
                  </div>
                  {onOpenAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenAccount()
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground transition-colors hover:bg-glass-strong"
                    >
                      <CreditCard className="size-3.5 text-sunset" /> Subscription & Account
                    </button>
                  )}
                  {onSignOut && (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-glass-strong hover:text-foreground"
                    >
                      <LogOut className="size-3.5" /> Sign out
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : onSignIn && stage === 'hero' ? (
          <button
            type="button"
            onClick={onSignIn}
            className="glass flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium text-foreground transition-transform hover:scale-105"
          >
            <UserIcon className="size-3.5 text-sunset" /> Sign in
          </button>
        ) : null}
      </div>
    </header>
  )
}
