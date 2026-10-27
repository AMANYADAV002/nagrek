'use client'

/**
 * useNagrekSession
 * -------------------------------------------------------------
 * The single source of truth for the whole Nagrek flow:
 *
 *   hero → select → matching → video → (accept | skip → matching)
 *
 * It owns:
 *  - the Socket.io connection (same origin, websocket + polling)
 *  - camera/mic acquisition and cleanup
 *  - RTCPeerConnection negotiation (offer/answer/ICE with buffering)
 *  - demo mode (simulated partner when nobody is around or media is blocked)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { FoodId } from '@/lib/foods'
import { GLOBAL_REGION } from '@/lib/regions'

export type Stage = 'hero' | 'auth' | 'onboarding' | 'paywall' | 'select' | 'matching' | 'video'
export type Mode = 'live' | 'demo'
export type SearchStatus = 'idle' | 'requesting-media' | 'connecting' | 'searching' | 'timeout'
export type MediaIssue = 'denied' | 'unavailable' | 'insecure' | 'not-found' | null

export interface MatchState {
  roomId: string
  initiator: boolean
  selfAccepted: boolean
  partnerAccepted: boolean
  bothAccepted: boolean
  connected: boolean
  partnerUserId?: string | null
}

/** Seconds to wait in an empty queue before offering retry / demo. */
export const SEARCH_TIMEOUT_S = 20
/** Seconds both users have to accept a match. */
export const DECISION_WINDOW_S = 10

const DEFAULT_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }]

function classifyMediaError(error: unknown): MediaIssue {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  return 'unavailable'
}

export function useNagrekSession(getAccessToken?: () => Promise<string | null> | string | null) {
  const [stage, setStage] = useState<Stage>('hero')
  const [food, setFood] = useState<FoodId | null>(null)
  const [region, setRegion] = useState<string>(GLOBAL_REGION)
  const [mode, setMode] = useState<Mode>('live')
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [mediaIssue, setMediaIssue] = useState<MediaIssue>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [locationCell, setLocationCell] = useState<string | null>(null)
  const [queueWaiting, setQueueWaiting] = useState(0)
  const [onlineCount, setOnlineCount] = useState(0)
  const [lastEndedMatchId, setLastEndedMatchId] = useState<string | null>(null)

  // Mutable refs so socket listeners never read stale React state.
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const roomRef = useRef<string | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const modeRef = useRef<Mode>('live')
  const queueRef = useRef<{ food: FoodId; region: string; cell?: string | null } | null>(null)
  const cellRef = useRef<string | null>(null)
  cellRef.current = locationCell

  modeRef.current = mode

  /* ------------------------------------------------------------ */
  /* Helpers                                                       */
  /* ------------------------------------------------------------ */

  const flash = useCallback((message: string) => {
    setNotice(message)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3800)
    return () => clearTimeout(t)
  }, [notice])

  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = null
  }, [])

  const clearDemoTimers = useCallback(() => {
    demoTimersRef.current.forEach(clearTimeout)
    demoTimersRef.current = []
  }, [])

  const armSearchTimer = useCallback(() => {
    clearSearchTimer()
    searchTimerRef.current = setTimeout(() => setStatus('timeout'), SEARCH_TIMEOUT_S * 1000)
  }, [clearSearchTimer])

  /** Close the peer connection and drop the remote stream. Local media is kept for the next match. */
  const destroyPeer = useCallback(() => {
    const pc = pcRef.current
    if (pc) {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.getReceivers().forEach((r) => r.track?.stop())
      pc.close()
    }
    pcRef.current = null
    roomRef.current = null
    pendingIceRef.current = []
    setRemoteStream(null)
    setMatch(null)
  }, [])

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
  }, [])

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return
    const queued = pendingIceRef.current
    pendingIceRef.current = []
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.warn('[nagrek] Failed to add buffered ICE candidate', error)
      }
    }
  }, [])

  /* ------------------------------------------------------------ */
  /* WebRTC                                                        */
  /* ------------------------------------------------------------ */

  const createPeer = useCallback(
    (roomId: string) => {
      const socket = socketRef.current
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
      pcRef.current = pc

      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!))

      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (stream) setRemoteStream(stream)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) socket?.emit('ice-candidate', { roomId, candidate: event.candidate.toJSON() })
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setMatch((m) => (m && m.roomId === roomId ? { ...m, connected: true } : m))
        }
        if (pc.connectionState === 'failed') {
          flash('Connection failed — finding someone else.')
          socket?.emit('skip', { roomId, reason: 'failed' })
        }
      }

      return pc
    },
    [flash],
  )

  /* ------------------------------------------------------------ */
  /* Demo mode                                                     */
  /* ------------------------------------------------------------ */

  const startDemoMatch = useCallback(() => {
    clearDemoTimers()
    clearSearchTimer()
    setMode('demo')
    setStage('matching')
    setStatus('searching')
    // Let the radar breathe for a moment so the flow feels real.
    demoTimersRef.current.push(
      setTimeout(() => {
        const roomId = `demo_${Date.now()}`
        roomRef.current = roomId
        setMatch({
          roomId,
          initiator: true,
          selfAccepted: false,
          partnerAccepted: false,
          bothAccepted: false,
          connected: true,
        })
        setStage('video')
        // The simulated partner accepts after a random delay.
        demoTimersRef.current.push(
          setTimeout(
            () => {
              setMatch((m) => {
                if (!m || m.roomId !== roomId) return m
                return { ...m, partnerAccepted: true, bothAccepted: m.selfAccepted }
              })
            },
            2200 + Math.random() * 2600,
          ),
        )
      }, 3200),
    )
  }, [clearDemoTimers, clearSearchTimer])

  /* ------------------------------------------------------------ */
  /* Socket.io                                                     */
  /* ------------------------------------------------------------ */

  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current

    // Same-origin connection — passes token and refreshes on reconnect
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      auth: async (cb) => {
        try {
          const token = typeof getAccessToken === 'function' ? await getAccessToken() : null
          let localUserId: string | null = null
          try {
            localUserId = localStorage.getItem('nagrek_local_user_id')
          } catch {
            /* ignore */
          }
          cb({ token, localUserId })
        } catch {
          cb({ token: null })
        }
      },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      // Rejoin automatically after a reconnect.
      if (queueRef.current && modeRef.current === 'live' && !roomRef.current) {
        socket.emit('join-queue', queueRef.current)
      }
    })
    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('connect_error', () => setSocketConnected(false))

    socket.on('config', ({ iceServers }: { iceServers: RTCIceServer[] }) => {
      if (Array.isArray(iceServers) && iceServers.length) iceServersRef.current = iceServers
    })

    socket.on('queued', (payload?: { globalWaiting?: number }) => {
      if (modeRef.current !== 'live') return
      setStatus((s) => (s === 'timeout' ? s : 'searching'))
      if (typeof payload?.globalWaiting === 'number') setQueueWaiting(payload.globalWaiting)
    })

    socket.on('queue-stats', (payload: { waiting?: number; online?: number }) => {
      if (typeof payload.waiting === 'number') setQueueWaiting(payload.waiting)
      if (typeof payload.online === 'number') setOnlineCount(payload.online)
    })

    socket.on('search-widened', () => {
      flash('Widening search to your region…')
    })

    socket.on('match-found', async ({ roomId, initiator, partnerUserId }: { roomId: string; initiator: boolean; partnerUserId?: string | null }) => {
      if (modeRef.current !== 'live') return
      clearSearchTimer()
      destroyPeer()
      roomRef.current = roomId
      setMatch({
        roomId,
        initiator,
        selfAccepted: false,
        partnerAccepted: false,
        bothAccepted: false,
        connected: false,
        partnerUserId: partnerUserId || null,
      })
      setStage('video')

      const pc = createPeer(roomId)
      if (initiator) {
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit('offer', { roomId, sdp: pc.localDescription })
        } catch (error) {
          console.error('[nagrek] Failed to create offer', error)
          socket.emit('skip', { roomId, reason: 'failed' })
        }
      }
    })

    socket.on('offer', async ({ roomId, sdp }: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
      if (roomId !== roomRef.current) return
      const pc = pcRef.current ?? createPeer(roomId)
      try {
        await pc.setRemoteDescription(sdp)
        await flushPendingIce()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('answer', { roomId, sdp: pc.localDescription })
      } catch (error) {
        console.error('[nagrek] Failed to handle offer', error)
        socket.emit('skip', { roomId, reason: 'failed' })
      }
    })

    socket.on('answer', async ({ roomId, sdp }: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current
      if (roomId !== roomRef.current || !pc) return
      try {
        await pc.setRemoteDescription(sdp)
        await flushPendingIce()
      } catch (error) {
        console.error('[nagrek] Failed to handle answer', error)
      }
    })

    socket.on('ice-candidate', async ({ roomId, candidate }: { roomId: string; candidate: RTCIceCandidateInit }) => {
      if (roomId !== roomRef.current || !candidate) return
      const pc = pcRef.current
      // Candidates can arrive before the remote description — buffer them.
      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current.push(candidate)
        return
      }
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.warn('[nagrek] Failed to add ICE candidate', error)
      }
    })

    socket.on('partner-accepted', ({ roomId }: { roomId: string }) => {
      setMatch((m) => (m && m.roomId === roomId ? { ...m, partnerAccepted: true } : m))
    })

    socket.on('both-accepted', ({ roomId }: { roomId: string }) => {
      setMatch((m) => (m && m.roomId === roomId ? { ...m, partnerAccepted: true, bothAccepted: true } : m))
    })

    const backToQueue = (message: string) => {
      if (modeRef.current !== 'live') return
      destroyPeer()
      setStage((s) => (s === 'video' ? 'matching' : s))
      setStatus('searching')
      flash(message)
      armSearchTimer()
    }

    socket.on('match-ended', ({ reason, byPartner, matchId }: { reason: string; byPartner: boolean; matchId?: string }) => {
      if (matchId) setLastEndedMatchId(matchId)
      if (reason === 'ended' || reason === 'complete') {
        destroyPeer()
        setStage('select')
        setStatus('idle')
        flash('Call ended. Rate how it went if you like.')
        return
      }
      if (reason === 'timeout') backToQueue('Time ran out — back in the queue.')
      else if (reason === 'failed') backToQueue('Could not connect — back in the queue.')
      else backToQueue(byPartner ? 'They skipped — finding someone new.' : 'Skipped — finding someone new.')
    })

    socket.on('partner-left', (payload?: { matchId?: string }) => {
      if (payload?.matchId) setLastEndedMatchId(payload.matchId)
      backToQueue('Your partner left — back in the queue.')
    })

    socket.on('error-message', (payload: { code?: string; message?: string } | string) => {
      if (typeof payload === 'object' && payload.code === 'PAYMENT_REQUIRED') {
        destroyPeer()
        setStage('paywall')
        flash('Active membership required to join live matchmaking.')
        return
      }
      const msg = typeof payload === 'string' ? payload : payload.message || (payload.code ? `[${payload.code}] Rate limit reached` : 'Error')
      flash(msg)
    })

    return socket
  }, [armSearchTimer, clearSearchTimer, createPeer, destroyPeer, flash, flushPendingIce])

  /* ------------------------------------------------------------ */
  /* Public actions                                                */
  /* ------------------------------------------------------------ */

  const acquireMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setMediaIssue('insecure')
      return null
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaIssue('unavailable')
      return null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      localStreamRef.current = stream
      setLocalStream(stream)
      setMediaIssue(null)
      return stream
    } catch (error) {
      setMediaIssue(classifyMediaError(error))
      return null
    }
  }, [])

  const begin = useCallback(
    async (selectedFood: FoodId) => {
      setFood(selectedFood)
      setStage('matching')
      setMode('live')
      modeRef.current = 'live'
      setStatus('requesting-media')

      const stream = await acquireMedia()
      if (!stream) {
        // No camera → full demo flow so the experience still works.
        startDemoMatch()
        return
      }

      setStatus('connecting')
      const socket = ensureSocket()
      queueRef.current = { food: selectedFood, region, cell: cellRef.current }
      socket.emit('join-queue', queueRef.current)
      if (socket.connected) setStatus('searching')
      armSearchTimer()
    },
    [acquireMedia, armSearchTimer, ensureSocket, region, startDemoMatch],
  )

  const retrySearch = useCallback(() => {
    if (!food) return
    clearDemoTimers()
    if (!localStreamRef.current) {
      begin(food)
      return
    }
    setMode('live')
    modeRef.current = 'live'
    setStatus('searching')
    const socket = ensureSocket()
    queueRef.current = { food, region, cell: cellRef.current }
    socket.emit('join-queue', queueRef.current)
    armSearchTimer()
  }, [armSearchTimer, begin, clearDemoTimers, ensureSocket, food, region])

  const callFriend = useCallback(
    async (friendId: string) => {
      setMode('live')
      modeRef.current = 'live'
      setStage('matching')
      setStatus('requesting-media')
      const stream = await acquireMedia()
      if (!stream) {
        flash('Camera needed for a friend call.')
        setStage('select')
        return
      }
      setStatus('connecting')
      const socket = ensureSocket()
      socket.emit('friend:call', { friendId })
      setStatus('searching')
      flash('Calling friend…')
    },
    [acquireMedia, ensureSocket, flash],
  )

  const switchToDemo = useCallback(() => {
    socketRef.current?.emit('leave-queue')
    queueRef.current = null
    destroyPeer()
    startDemoMatch()
  }, [destroyPeer, startDemoMatch])

  const accept = useCallback(() => {
    if (!match || match.selfAccepted) return
    if (modeRef.current === 'demo') {
      setMatch((m) => (m ? { ...m, selfAccepted: true, bothAccepted: m.partnerAccepted } : m))
      return
    }
    setMatch((m) => (m ? { ...m, selfAccepted: true } : m))
    socketRef.current?.emit('accept', { roomId: match.roomId })
  }, [match])

  const skip = useCallback(
    (reason: 'skip' | 'timeout' = 'skip') => {
      if (!match) return
      if (modeRef.current === 'demo') {
        clearDemoTimers()
        roomRef.current = null
        setMatch(null)
        flash(reason === 'timeout' ? 'Time ran out — finding another demo partner.' : 'Skipped — finding someone new.')
        startDemoMatch()
        return
      }
      // Server ends the room and requeues us; `match-ended` drives the UI.
      socketRef.current?.emit('skip', { roomId: match.roomId, reason })
      destroyPeer()
      setStage('matching')
      setStatus('searching')
      armSearchTimer()
    },
    [armSearchTimer, clearDemoTimers, destroyPeer, flash, match, startDemoMatch],
  )

  const reportPartner = useCallback(
    async (reason: string) => {
      if (!match) return
      try {
        const token = typeof getAccessToken === 'function' ? await getAccessToken() : null
        if (token) {
          await fetch('/api/report', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reported_id: match.partnerUserId,
              match_id: match.roomId,
              reason,
            }),
          })
        }
      } catch (err) {
        console.error('[nagrek] Report partner error:', err)
      }
      flash('Report submitted. Thank you for keeping Nagrek safe.')
      skip('skip')
    },
    [flash, getAccessToken, match, skip],
  )

  const blockPartner = useCallback(async () => {
    if (!match) return
    try {
      const token = typeof getAccessToken === 'function' ? await getAccessToken() : null
      if (token && match.partnerUserId) {
        await fetch('/api/block', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            blocked_id: match.partnerUserId,
          }),
        })
      }
    } catch (err) {
      console.error('[nagrek] Block partner error:', err)
    }
    flash('User blocked. You will never be matched with them again.')
    skip('skip')
  }, [flash, getAccessToken, match, skip])

  /** Leave matching/video and go back to the craving selector. */
  const changeCraving = useCallback(() => {
    socketRef.current?.emit('leave-queue')
    queueRef.current = null
    clearSearchTimer()
    clearDemoTimers()
    destroyPeer()
    setStatus('idle')
    setMode('live')
    setStage('select')
  }, [clearDemoTimers, clearSearchTimer, destroyPeer])

  const goHome = useCallback(() => {
    changeCraving()
    stopLocalMedia()
    setStage('hero')
  }, [changeCraving, stopLocalMedia])

  const start = useCallback(() => setStage('select'), [])
  const goToAuth = useCallback(() => setStage('auth'), [])
  const goToOnboarding = useCallback(() => setStage('onboarding'), [])
  const goToPaywall = useCallback(() => setStage('paywall'), [])

  // Full cleanup on unmount (tab close / navigation).
  useEffect(() => {
    return () => {
      clearSearchTimer()
      clearDemoTimers()
      pcRef.current?.close()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [clearDemoTimers, clearSearchTimer])

  return {
    stage,
    setStage,
    food,
    region,
    setRegion,
    locationCell,
    setLocationCell,
    mode,
    status,
    mediaIssue,
    localStream,
    remoteStream,
    match,
    notice,
    socketConnected,
    queueWaiting,
    onlineCount,
    lastEndedMatchId,
    setLastEndedMatchId,
    actions: {
      start,
      goToAuth,
      goToOnboarding,
      goToPaywall,
      begin,
      retrySearch,
      switchToDemo,
      accept,
      skip,
      reportPartner,
      blockPartner,
      callFriend,
      changeCraving,
      goHome,
    },
  }
}

export type NagrekSession = ReturnType<typeof useNagrekSession>
