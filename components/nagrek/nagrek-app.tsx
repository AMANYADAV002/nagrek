'use client'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useNagrekSession } from '@/hooks/use-nagrek-session'
import { getFood } from '@/lib/foods'
import { BackgroundCanvas } from './background-canvas'
import { CravingScreen } from './craving-screen'
import { CursorFollower } from './cursor-follower'
import { HeroScreen } from './hero-screen'
import { MatchingScreen } from './matching-screen'
import { SiteHeader } from './site-header'
import { VideoScreen } from './video-screen'

export function NagrekApp() {
  const session = useNagrekSession()
  const { stage, region, mode, status, match, notice, actions } = session
  const food = getFood(session.food)

  return (
    <div className="cursor-none-fine relative min-h-dvh">
      <BackgroundCanvas intensity={stage === 'video' ? 0.5 : 1} />
      <CursorFollower />
      <SiteHeader stage={stage} mode={mode} region={region} socketConnected={session.socketConnected} onHome={actions.goHome} />

      <main>
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {stage === 'hero' && <HeroScreen key="hero" onStart={actions.start} />}
            {stage === 'select' && (
              <CravingScreen key="select" region={region} onRegionChange={session.setRegion} onSelect={actions.begin} />
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
              />
            )}
          </AnimatePresence>
        </LayoutGroup>
      </main>

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
