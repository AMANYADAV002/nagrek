'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useNagrekSession } from '@/hooks/use-nagrek-session'
import { useSubscription } from '@/hooks/use-subscription'
import { getFood } from '@/lib/foods'
import { isPaywallBypassedClient } from '@/lib/paywall'
import { AccountModal } from './account-modal'
import { AuthScreen } from './auth-screen'
import { BackgroundCanvas } from './background-canvas'
import { CravingScreen } from './craving-screen'
import { FriendsScreen } from './friends-screen'
import { HeroScreen } from './hero-screen'
import { MatchingScreen } from './matching-screen'
import { PaywallScreen } from './paywall-screen'
import { PostCallRating } from './post-call-rating'
import { ProfileSetupScreen } from './profile-setup-screen'
import { SiteHeader } from './site-header'
import { VideoScreen } from './video-screen'

export function NagrekApp() {
  const auth = useAuth()
  const getAccessToken = useCallback(
    () => auth.session?.access_token ?? null,
    [auth.session?.access_token],
  )
  const getAccessTokenAsync = auth.getAccessToken
  const sub = useSubscription(getAccessToken)
  const session = useNagrekSession(getAccessToken)
  const { stage, region, mode, status, match, notice, actions } = session
  const food = getFood(session.food)

  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const paywallBypassed = isPaywallBypassedClient()
  const needsPaywall = !paywallBypassed && !sub.subscribed && !sub.loading

  useEffect(() => {
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'landing_view' }),
    }).catch(() => {})
  }, [])

  // Capture referral ?ref=username-or-id
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      try {
        localStorage.setItem('nagrek_ref', ref)
      } catch {
        /* ignore */
      }
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'referral_click', props: { ref } }),
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (stage === 'select' && !auth.user && mode !== 'demo' && !auth.loading) {
      actions.goToAuth()
    } else if (stage === 'select' && auth.user && auth.needsProfile && mode !== 'demo' && !auth.loading) {
      actions.goToOnboarding()
    } else if (stage === 'select' && auth.user && needsPaywall && mode !== 'demo') {
      actions.goToPaywall()
    }
  }, [stage, auth.user, auth.needsProfile, needsPaywall, mode, auth.loading, actions])

  useEffect(() => {
    if (stage === 'auth' && auth.user) {
      if (auth.profile?.banned_at) {
        return
      }
      if (auth.needsProfile && mode !== 'demo') {
        actions.goToOnboarding()
      } else if (needsPaywall && mode !== 'demo') {
        actions.goToPaywall()
      } else {
        actions.start()
      }
    }
  }, [stage, auth.user, auth.profile?.banned_at, auth.needsProfile, needsPaywall, mode, actions])

  const handleHeroStart = useCallback(() => {
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'start_click' }),
    }).catch(() => {})
    // No Supabase → auto guest so video + friends work locally without keys
    if (!auth.isConfigured && !auth.user) {
      auth.signInAsGuest()
      actions.start()
      return
    }
    if (!auth.user && mode !== 'demo') {
      actions.goToAuth()
    } else if (auth.user && auth.profile?.banned_at && mode !== 'demo') {
      actions.goToAuth()
    } else if (auth.user && auth.needsProfile && mode !== 'demo') {
      actions.goToOnboarding()
    } else if (auth.user && needsPaywall && mode !== 'demo') {
      actions.goToPaywall()
    } else {
      actions.start()
    }
  }, [auth, needsPaywall, mode, actions])

  const handleProfileComplete = useCallback(
    async ({
      username,
      displayName,
      avatarUrl,
      ageConfirmed,
      instagram,
      snapchat,
      facebook,
      linkedin,
    }: {
      username: string
      displayName: string
      avatarUrl: string | null
      ageConfirmed: boolean
      instagram: string | null
      snapchat: string | null
      facebook: string | null
      linkedin: string | null
    }) => {
      const { error } = await auth.updateProfile({
        username,
        display_name: displayName,
        avatar_url: avatarUrl,
        age_confirmed_at: ageConfirmed ? new Date().toISOString() : null,
        instagram,
        snapchat,
        facebook,
        linkedin,
      })
      if (error) throw error

      const token = await getAccessTokenAsync()
      fetch('/api/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: 'onboarding_done' }),
      }).catch(() => {})

      // Attach referral if present (reward deferred until payments)
      try {
        const ref = localStorage.getItem('nagrek_ref')
        if (ref && token) {
          fetch('/api/referrals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ referrer: ref }),
          }).catch(() => {})
        }
      } catch {
        /* ignore */
      }

      if (needsPaywall && mode !== 'demo') {
        actions.goToPaywall()
      } else {
        actions.start()
      }
    },
    [auth, needsPaywall, mode, actions, getAccessTokenAsync],
  )

  const handleAddFriend = useCallback(async () => {
    if (!match?.partnerUserId) return
    const token = await getAccessTokenAsync()
    if (!token) return
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receiver_id: match.partnerUserId }),
    })
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'friend_added' }),
    }).catch(() => {})
  }, [match?.partnerUserId, getAccessTokenAsync])

  const handleRate = useCallback(
    async (rating: number) => {
      const matchId = session.lastEndedMatchId || match?.roomId
      if (!matchId) return
      const token = await getAccessTokenAsync()
      if (!token) return
      await fetch('/api/matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ match_id: matchId, rating }),
      })
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'rating_submitted', props: { rating } }),
      }).catch(() => {})
    },
    [session.lastEndedMatchId, match?.roomId, getAccessTokenAsync],
  )

  return (
    <div className="relative min-h-dvh">
      <BackgroundCanvas intensity={stage === 'video' ? 0.35 : 0.7} />
      <SiteHeader
        stage={stage}
        mode={mode}
        region={region}
        socketConnected={session.socketConnected}
        displayName={auth.profile?.display_name || auth.profile?.username || undefined}
        avatarUrl={auth.profile?.avatar_url}
        queueWaiting={session.queueWaiting}
        onlineCount={session.onlineCount}
        onHome={actions.goHome}
        onSignOut={auth.signOut}
        onSignIn={actions.goToAuth}
        onOpenAccount={() => setAccountModalOpen(true)}
        onOpenFriends={auth.user ? () => setFriendsOpen(true) : undefined}
      />

      <main>
        <AnimatePresence mode="wait">
          {stage === 'hero' && <HeroScreen key="hero" onStart={handleHeroStart} />}
          {stage === 'auth' && (
            <AuthScreen
              key="auth"
              onGoogle={auth.signInWithGoogle}
              onEmail={auth.signInWithEmail}
              onDemo={() => {
                actions.switchToDemo()
                actions.start()
              }}
              onBack={actions.goHome}
              isConfigured={auth.isConfigured}
              bannedNotice={
                auth.profile?.banned_at
                  ? { reason: auth.profile.ban_reason || 'Violation of community safety policies' }
                  : null
              }
            />
          )}
          {stage === 'onboarding' && (
            <ProfileSetupScreen
              key="onboarding"
              defaultName={auth.user?.user_metadata?.full_name ?? auth.user?.user_metadata?.name ?? ''}
              defaultUsername={auth.user?.user_metadata?.username ?? ''}
              onComplete={handleProfileComplete}
            />
          )}
          {stage === 'paywall' && (
            <PaywallScreen
              key="paywall"
              onSubscribe={sub.subscribe}
              onSuccess={async () => {
                await sub.checkStatus()
                actions.start()
              }}
              onDemo={() => {
                actions.switchToDemo()
                actions.start()
              }}
            />
          )}
          {stage === 'select' && (
            <CravingScreen
              key="select"
              region={region}
              onRegionChange={session.setRegion}
              onCellChange={session.setLocationCell}
              onSelect={actions.begin}
              queueWaiting={session.queueWaiting}
              onlineCount={session.onlineCount}
            />
          )}
          {stage === 'matching' && food && (
            <MatchingScreen
              key="matching"
              food={food}
              region={region}
              mode={mode}
              status={status}
              mediaIssue={session.mediaIssue}
              localStream={session.localStream}
              queueWaiting={session.queueWaiting}
              onRetry={actions.retrySearch}
              onDemo={actions.switchToDemo}
              onBack={actions.changeCraving}
            />
          )}
          {stage === 'video' && food && match && (
            <VideoScreen
              key="video"
              food={food}
              region={region}
              mode={mode}
              match={match}
              localStream={session.localStream}
              remoteStream={session.remoteStream}
              onAccept={actions.accept}
              onSkip={actions.skip}
              onLeave={actions.changeCraving}
              onReport={actions.reportPartner}
              onBlock={actions.blockPartner}
              onAddFriend={handleAddFriend}
              onRate={handleRate}
            />
          )}
        </AnimatePresence>
      </main>

      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        displayName={auth.profile?.display_name || auth.profile?.username || undefined}
        username={auth.profile?.username}
        email={auth.user?.email}
        social={{
          instagram: auth.profile?.instagram,
          snapchat: auth.profile?.snapchat,
          facebook: auth.profile?.facebook,
          linkedin: auth.profile?.linkedin,
        }}
        subscription={sub.subscription}
        invitePath={auth.user ? `/?ref=${auth.user.id}` : undefined}
        onCancelSubscription={sub.cancel}
        onSaveSocial={(handles) => auth.updateProfile(handles)}
        onOpenPaywall={() => {
          setAccountModalOpen(false)
          actions.goToPaywall()
        }}
      />

      <AnimatePresence>
        {friendsOpen && (
          <FriendsScreen
            key="friends"
            getAccessToken={getAccessTokenAsync}
            onlineIds={new Set()}
            onCallFriend={(id) => {
              setFriendsOpen(false)
              actions.callFriend(id)
            }}
            onClose={() => setFriendsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {session.lastEndedMatchId && stage === 'select' && mode !== 'demo' && (
          <PostCallRating
            key="post-call-rating"
            onRate={handleRate}
            onDismiss={() => session.setLastEndedMatchId(null)}
          />
        )}
      </AnimatePresence>

      {auth.user && stage !== 'hero' && stage !== 'auth' && (
        <button
          type="button"
          onClick={() => setFriendsOpen(true)}
          className="glass fixed bottom-6 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg md:bottom-8 md:right-8"
          aria-label="Open friends"
        >
          <Users className="size-4 text-accent" />
          Friends
        </button>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4" aria-live="assertive">
        <AnimatePresence>
          {notice && (
            <motion.p
              key={notice}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="glass rounded-full px-5 py-2.5 text-sm font-medium"
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
