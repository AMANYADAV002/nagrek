/**
 * Nagrek custom server
 * -------------------------------------------------------------
 * Runs Next.js AND Socket.io on the SAME HTTP server / port so the
 * whole app deploys as a single Node.js process (Hostinger friendly).
 *
 * Responsibilities:
 *  - Serve the Next.js app (pages, assets, HMR in development)
 *  - Matchmaking: in-memory queues keyed by `region + food`
 *  - WebRTC signaling relay: offer / answer / ice-candidate
 *  - Match decisions: accept / skip / timeout, plus disconnect cleanup
 */

const { createServer } = require('node:http')
const next = require('next')
const { Server } = require('socket.io')

// Note: Next.js loads .env / .env.production files into process.env during
// `app.prepare()`, so env vars are read only after prepare() resolves.

// Production is the default so hosts that launch `node server.js` directly
// (e.g. Hostinger hPanel "entry file") never start the dev server by accident.
const dev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
if (dev) process.env.NODE_ENV = 'development'
else process.env.NODE_ENV = 'production'
const port = Number.parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOST || '0.0.0.0'

/** Allowed food ids. Anything else sent by a client is rejected. */
const FOODS = new Set([
  'pizza',
  'sushi',
  'coffee',
  'burger',
  'biryani',
  'dosa',
  'chai',
  'icecream',
  'custom',
])
/** Regions must be short, printable strings. */
const REGION_PATTERN = /^[\w\s\-—,.&()]{1,48}$/u
/** Coarse location cell e.g. "12.9,77.6" */
const CELL_PATTERN = /^-?\d{1,3}\.\d,-?\d{1,3}\.\d$/
/** How long two users who skipped each other are kept apart (ms). */
const SKIP_COOLDOWN_MS = 20_000
/** Safety net: a pending match that is never resolved gets torn down. */
const MATCH_DECISION_TIMEOUT_MS = 30_000
/** After this, widen search from cell → region. */
const SEARCH_WIDEN_MS = 20_000

/* ------------------------------------------------------------------ */
/* ICE configuration (STUN always, TURN when env vars are present)     */
/* ------------------------------------------------------------------ */

function buildIceServers() {
  const iceServers = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ]

  const { TURN_URL, TURN_USERNAME, TURN_CREDENTIAL } = process.env
  if (TURN_URL) {
    iceServers.push({
      // TURN_URL may contain several comma separated URLs
      urls: TURN_URL.split(',').map((url) => url.trim()).filter(Boolean),
      username: TURN_USERNAME || undefined,
      credential: TURN_CREDENTIAL || undefined,
    })
  } else {
    console.warn(
      '[nagrek] TURN_URL is not set. WebRTC will fail for many users on mobile data or strict NATs. Set TURN_URL, TURN_USERNAME and TURN_CREDENTIAL.',
    )
  }
  return iceServers
}

/* ------------------------------------------------------------------ */
/* Matchmaking state (in memory — resets when the process restarts)    */
/* ------------------------------------------------------------------ */

let supabaseAdmin = null
function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && supabaseServiceKey) {
    const { createClient } = require('@supabase/supabase-js')
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    console.log('[nagrek] Supabase auth verification enabled.')
  }
  return supabaseAdmin
}

async function isPairBlocked(userA, userB) {
  if (!userA || !userB || userA === userB) return false
  if (
    userA.startsWith('guest-') ||
    userB.startsWith('guest-') ||
    userA.startsWith('mock-') ||
    userB.startsWith('mock-') ||
    userA.startsWith('user-') ||
    userB.startsWith('user-')
  ) {
    return false
  }
  const admin = getSupabaseAdmin()
  if (!admin) return false
  try {
    const { data, error } = await admin
      .from('blocks')
      .select('blocker_id')
      .or(`and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`)
      .limit(1)
    if (error) {
      console.warn('[nagrek] Block query warning:', error.message)
      return false
    }
    return Boolean(data && data.length > 0)
  } catch (err) {
    console.warn('[nagrek] Block check exception:', err)
    return false
  }
}

/** queueKey -> array of socket ids waiting (FIFO) */
const queues = new Map()
/** roomId -> { id, a, b, accepted:Set, timer, food, region, cell, startedAt } */
const rooms = new Map()
/** userId -> socket.id for online presence / friend calls */
const onlineByUser = new Map()

const cellQueueKey = (cell, food) => `cell:${cell}::${food}`
const regionQueueKey = (region, food) => `region:${region.toLowerCase()}::${food}`

function removeFromQueue(socket) {
  const key = socket.data.queueKey
  if (!key) return
  const list = queues.get(key)
  if (list) {
    const index = list.indexOf(socket.id)
    if (index !== -1) list.splice(index, 1)
    if (list.length === 0) queues.delete(key)
  }
  socket.data.queueKey = null
  if (socket.data.widenTimer) {
    clearTimeout(socket.data.widenTimer)
    socket.data.widenTimer = null
  }
}

function totalQueued() {
  let n = 0
  for (const list of queues.values()) n += list.length
  return n
}

function emitQueueStats(io) {
  io.emit('queue-stats', { waiting: totalQueued(), online: onlineByUser.size })
}

async function persistMatch(room, outcome) {
  const admin = getSupabaseAdmin()
  if (!admin || !room) return
  const a = room.userA
  const b = room.userB
  if (!a || !b || String(a).startsWith('guest-') || String(b).startsWith('guest-')) return
  try {
    await admin.from('matches').upsert({
      id: room.id,
      user_a: a,
      user_b: b,
      food: room.food || null,
      region: room.region || null,
      location_cell: room.cell || null,
      started_at: room.startedAt ? new Date(room.startedAt).toISOString() : new Date().toISOString(),
      ended_at: new Date().toISOString(),
      outcome,
    })
  } catch (err) {
    console.warn('[nagrek] match persist failed:', err)
  }
}

async function areFriends(userA, userB) {
  if (!userA || !userB) return false
  const admin = getSupabaseAdmin()
  if (!admin) return false
  try {
    const { data } = await admin
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${userA},receiver_id.eq.${userB}),and(requester_id.eq.${userB},receiver_id.eq.${userA})`,
      )
      .limit(1)
    return Boolean(data && data.length)
  } catch {
    return false
  }
}

function recentlySkipped(socketA, socketB) {
  const now = Date.now()
  const a = socketA.data.skips.get(socketB.id)
  const b = socketB.data.skips.get(socketA.id)
  return (a && now - a < SKIP_COOLDOWN_MS) || (b && now - b < SKIP_COOLDOWN_MS)
}

/**
 * Put a socket in its queue and immediately try to pair it.
 * Prefers cell::food; after SEARCH_WIDEN_MS falls back to region::food.
 */
function enqueue(io, socket, { widen = false } = {}) {
  const { region, food, cell } = socket.data
  if (!region || !food) return
  if (socket.data.roomId) return

  removeFromQueue(socket)
  const useCell = Boolean(cell && CELL_PATTERN.test(cell) && !widen)
  const key = useCell ? cellQueueKey(cell, food) : regionQueueKey(region, food)
  const list = queues.get(key) || []
  if (!list.includes(socket.id)) list.push(socket.id)
  queues.set(key, list)
  socket.data.queueKey = key
  socket.data.queueMode = useCell ? 'cell' : 'region'

  socket.emit('queued', {
    region,
    food,
    cell: useCell ? cell : null,
    mode: socket.data.queueMode,
    waiting: list.length,
    globalWaiting: totalQueued(),
  })
  emitQueueStats(io)
  tryMatch(io, key)

  if (useCell && !socket.data.widenTimer) {
    socket.data.widenTimer = setTimeout(() => {
      socket.data.widenTimer = null
      if (!socket.connected || socket.data.roomId || !socket.data.wantsQueue) return
      socket.emit('search-widened', { region, food })
      enqueue(io, socket, { widen: true })
    }, SEARCH_WIDEN_MS)
  }
}

/** Pair the first two compatible sockets of a queue. */
async function tryMatch(io, key) {
  const list = queues.get(key)
  if (!list || list.length < 2) return

  for (let i = 0; i < list.length; i++) {
    const first = io.sockets.sockets.get(list[i])
    if (!first || !first.connected) continue
    for (let j = i + 1; j < list.length; j++) {
      const second = io.sockets.sockets.get(list[j])
      if (!second || !second.connected || recentlySkipped(first, second)) continue

      const blocked = await isPairBlocked(first.data.userId, second.data.userId)
      // Check that sockets are still connected and in the queue
      if (!first.connected || !second.connected) continue
      if (first.data.queueKey !== key || second.data.queueKey !== key) continue
      if (first.data.roomId || second.data.roomId) continue

      if (blocked) continue

      createRoom(io, first, second)
      return tryMatch(io, key) // more pairs may be possible
    }
  }
}

function createRoom(io, a, b, { direct = false } = {}) {
  removeFromQueue(a)
  removeFromQueue(b)

  const roomId = `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const room = {
    id: roomId,
    a: a.id,
    b: b.id,
    userA: a.data.userId || null,
    userB: b.data.userId || null,
    food: a.data.food || b.data.food || null,
    region: a.data.region || b.data.region || null,
    cell: a.data.cell || b.data.cell || null,
    startedAt: Date.now(),
    accepted: new Set(),
    direct,
    timer: setTimeout(() => endRoom(io, roomId, { reason: 'timeout' }), MATCH_DECISION_TIMEOUT_MS),
  }
  rooms.set(roomId, room)
  a.data.roomId = roomId
  b.data.roomId = roomId
  a.data.wantsQueue = direct ? false : a.data.wantsQueue
  b.data.wantsQueue = direct ? false : b.data.wantsQueue

  a.emit('match-found', {
    roomId,
    initiator: true,
    region: a.data.region,
    food: a.data.food,
    partnerUserId: b.data.userId || null,
    direct,
  })
  b.emit('match-found', {
    roomId,
    initiator: false,
    region: b.data.region,
    food: b.data.food,
    partnerUserId: a.data.userId || null,
    direct,
  })
  emitQueueStats(io)
}

function partnerOf(io, socket) {
  const room = rooms.get(socket.data.roomId)
  if (!room) return null
  const partnerId = room.a === socket.id ? room.b : room.a
  return io.sockets.sockets.get(partnerId) || null
}

/**
 * Tear down a room and requeue whoever is still connected.
 * @param {object} opts
 * @param {string} opts.reason  'skip' | 'timeout' | 'disconnect' | 'failed'
 * @param {string} [opts.by]    socket id that caused the end
 */
function endRoom(io, roomId, { reason, by } = {}) {
  const room = rooms.get(roomId)
  if (!room) return
  clearTimeout(room.timer)
  rooms.delete(roomId)

  const sockets = [room.a, room.b].map((id) => io.sockets.sockets.get(id)).filter(Boolean)

  let outcome = 'left'
  if (reason === 'skip') outcome = 'skipped'
  else if (reason === 'timeout') outcome = 'timeout'
  else if (reason === 'failed') outcome = 'failed'
  else if (reason === 'disconnect') outcome = 'left'
  else if (reason === 'ended' || reason === 'complete') outcome = 'accepted'
  if (room.accepted && room.accepted.size === 2 && (reason === 'ended' || reason === 'complete' || reason === 'disconnect')) {
    outcome = 'accepted'
  }
  // If both had accepted and someone leaves later, still accepted
  if (room.accepted && room.accepted.size === 2) outcome = outcome === 'skipped' ? 'skipped' : 'accepted'

  persistMatch(room, outcome)

  if (reason === 'skip' || reason === 'timeout') {
    const [x, y] = sockets
    if (x && y) {
      x.data.skips.set(y.id, Date.now())
      y.data.skips.set(x.id, Date.now())
    }
  }

  for (const s of sockets) {
    s.data.roomId = null
    const event = s.id === by ? 'match-ended' : reason === 'disconnect' ? 'partner-left' : 'match-ended'
    s.emit(event, { reason, byPartner: Boolean(by) && s.id !== by, matchId: roomId })
  }

  emitQueueStats(io)

  setTimeout(() => {
    for (const s of sockets) {
      if (s.connected && s.data.wantsQueue && !room.direct) enqueue(io, s)
    }
  }, 400)
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

const httpServer = createServer()
const app = next({ dev, hostname, port, httpServer })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    httpServer.on('request', (req, res) => {
      // Socket.io handles its own path; everything else goes to Next.js.
      if (req.url && req.url.startsWith('/socket.io')) return
      handle(req, res)
    })

    const io = new Server(httpServer, {
      path: '/socket.io',
      // Polling fallback keeps things working when proxies block WebSockets.
      transports: ['websocket', 'polling'],
      // Same-origin by default; set CLIENT_ORIGIN (comma separated) to allow others.
      cors: process.env.CLIENT_ORIGIN
        ? { origin: process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim()), credentials: true }
        : undefined,
      // Do not kill Next.js' own HMR WebSocket upgrades in development.
      destroyUpgrade: false,
      pingInterval: 20_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 1e5, // SDP + ICE payloads are small
    })

    const USER_RATE_LIMITS = {
      'join-queue': { max: 10, windowMs: 60_000 },
      'skip': { max: 30, windowMs: 60_000 },
      'report': { max: 5, windowMs: 3_600_000 },
    }
    const userRateBuckets = new Map()

    function checkRateLimit(userId, event) {
      const rule = USER_RATE_LIMITS[event]
      if (!rule) return true
      const now = Date.now()
      if (!userRateBuckets.has(userId)) {
        userRateBuckets.set(userId, {})
      }
      const buckets = userRateBuckets.get(userId)
      const timestamps = (buckets[event] || []).filter((t) => now - t < rule.windowMs)
      if (timestamps.length >= rule.max) {
        return false
      }
      timestamps.push(now)
      buckets[event] = timestamps
      return true
    }

    // Socket auth middleware: verify Supabase JWT, attach userId, check ban & age
    io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token
      if (!token) {
        return next(new Error('Authentication required. Missing token.'))
      }

      const admin = getSupabaseAdmin()
      if (admin) {
        try {
          const { data, error } = await admin.auth.getUser(token)
          if (error || !data?.user) {
            return next(new Error('Invalid or expired authentication token.'))
          }
          socket.data.userId = data.user.id

          // Check profile for ban or missing age confirmation
          const { data: profile } = await admin
            .from('profiles')
            .select('banned_at, ban_reason, age_confirmed_at')
            .eq('id', socket.data.userId)
            .single()

          if (profile) {
            if (profile.banned_at) {
              return next(
                new Error(
                  `Account banned: ${profile.ban_reason || 'Community violation'}. Contact appeals@nagrek.com to appeal.`
                )
              )
            }
            if (!profile.age_confirmed_at) {
              return next(new Error('Age verification required. You must be 18+ to join.'))
            }
          }
        } catch (err) {
          console.error('[nagrek] Socket auth verification error:', err)
          return next(new Error('Authentication failed.'))
        }
      } else {
        // Fallback for demo / development without Supabase keys
        if (token === 'dev-guest-token' || token.startsWith('mock-')) {
          socket.data.userId = 'guest-' + socket.id
        } else {
          socket.data.userId = 'user-' + socket.id
        }
      }
      next()
    })

    const iceServers = buildIceServers()

    io.on('connection', (socket) => {
      socket.data.region = null
      socket.data.food = null
      socket.data.cell = null
      socket.data.queueKey = null
      socket.data.roomId = null
      socket.data.wantsQueue = false
      socket.data.widenTimer = null
      socket.data.skips = new Map()

      if (socket.data.userId) {
        onlineByUser.set(socket.data.userId, socket.id)
        emitQueueStats(io)
      }

      socket.emit('config', { iceServers })
      socket.emit('queue-stats', { waiting: totalQueued(), online: onlineByUser.size })

      socket.on('join-queue', async (payload = {}) => {
        const userId = socket.data.userId || socket.id
        if (!checkRateLimit(userId, 'join-queue')) {
          socket.emit('error-message', {
            code: 'RATE_LIMIT',
            message: 'Too many search attempts. Limit is 10 per minute.',
          })
          return
        }

        // ws.gate: require subscriptions.status in (trial, active) unless paywall bypassed
        const skipPaywall =
          process.env.NAGREK_SKIP_PAYWALL === '1' ||
          (!process.env.RAZORPAY_KEY_ID && !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)
        const admin = getSupabaseAdmin()
        if (!skipPaywall && admin && socket.data.userId && !socket.data.userId.startsWith('guest-')) {
          try {
            const { data: sub } = await admin
              .from('subscriptions')
              .select('status, current_period_end')
              .eq('user_id', socket.data.userId)
              .single()

            const hasActiveSub =
              sub &&
              ['trial', 'active'].includes(sub.status) &&
              (!sub.current_period_end || new Date(sub.current_period_end) > new Date())

            if (!hasActiveSub) {
              socket.emit('error-message', {
                code: 'PAYMENT_REQUIRED',
                message: 'An active membership or free trial is required to join matchmaking.',
              })
              return
            }
          } catch (err) {
            console.warn('[nagrek] Subscription check failed:', err)
          }
        }

        const food = String(payload.food || '')
        const region = String(payload.region || 'Global').trim()
        const cellRaw = payload.cell ? String(payload.cell).trim() : ''
        const cell = CELL_PATTERN.test(cellRaw) ? cellRaw : null
        if (!FOODS.has(food) || !REGION_PATTERN.test(region)) {
          socket.emit('error-message', { message: 'Invalid craving or region.' })
          return
        }
        if (socket.data.roomId) return
        socket.data.food = food
        socket.data.region = region
        socket.data.cell = cell
        socket.data.wantsQueue = true

        // Persist location_cell on profile (never raw coords)
        if (admin && cell && socket.data.userId && !String(socket.data.userId).startsWith('guest-')) {
          admin
            .from('profiles')
            .update({ location_cell: cell, location_updated_at: new Date().toISOString() })
            .eq('id', socket.data.userId)
            .then(() => {})
            .catch(() => {})
        }

        enqueue(io, socket)
      })

      socket.on('friend:call', async ({ friendId } = {}) => {
        const userId = socket.data.userId
        if (!userId || !friendId || friendId === userId) {
          socket.emit('error-message', { message: 'Invalid friend call.' })
          return
        }
        if (socket.data.roomId) return
        const friends = await areFriends(userId, friendId)
        if (!friends) {
          socket.emit('error-message', { message: 'You can only call accepted friends.' })
          return
        }
        const blocked = await isPairBlocked(userId, friendId)
        if (blocked) {
          socket.emit('error-message', { message: 'Cannot call this user.' })
          return
        }
        const targetSocketId = onlineByUser.get(friendId)
        const target = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null
        if (!target || !target.connected || target.data.roomId) {
          socket.emit('error-message', { code: 'FRIEND_OFFLINE', message: 'Friend is offline or busy.' })
          return
        }
        socket.data.wantsQueue = false
        target.data.wantsQueue = false
        removeFromQueue(socket)
        removeFromQueue(target)
        createRoom(io, socket, target, { direct: true })
      })

      socket.on('leave-queue', () => {
        socket.data.wantsQueue = false
        removeFromQueue(socket)
        if (socket.data.roomId) endRoom(io, socket.data.roomId, { reason: 'skip', by: socket.id })
      })

      // ---- WebRTC signaling relay (only within the same room) ----
      for (const event of ['offer', 'answer', 'ice-candidate']) {
        socket.on(event, (data) => {
          const partner = partnerOf(io, socket)
          if (partner && data && data.roomId === socket.data.roomId) partner.emit(event, data)
        })
      }

      socket.on('accept', ({ roomId } = {}) => {
        const room = rooms.get(roomId)
        if (!room || socket.data.roomId !== roomId) return
        room.accepted.add(socket.id)
        const partner = partnerOf(io, socket)
        if (partner) partner.emit('partner-accepted', { roomId })
        if (room.accepted.size === 2) {
          clearTimeout(room.timer) // match confirmed, no decision timeout anymore
          io.to(room.a).emit('both-accepted', { roomId })
          io.to(room.b).emit('both-accepted', { roomId })
        }
      })

      socket.on('skip', ({ roomId, reason } = {}) => {
        const userId = socket.data.userId || socket.id
        if (!checkRateLimit(userId, 'skip')) {
          socket.emit('error-message', {
            code: 'RATE_LIMIT',
            message: 'Too many skip attempts. Limit is 30 per minute.',
          })
          return
        }
        if (!roomId || socket.data.roomId !== roomId) return
        endRoom(io, roomId, { reason: reason === 'timeout' ? 'timeout' : reason === 'failed' ? 'failed' : 'skip', by: socket.id })
      })

      socket.on('report', (payload = {}) => {
        const userId = socket.data.userId || socket.id
        if (!checkRateLimit(userId, 'report')) {
          socket.emit('error-message', {
            code: 'RATE_LIMIT',
            message: 'Too many reports. Limit is 5 per hour.',
          })
          return
        }
        console.log(`[nagrek] User report received from ${userId}:`, payload)
        socket.emit('report-received', { success: true })
      })

      socket.on('leave-call', ({ roomId } = {}) => {
        if (roomId && socket.data.roomId === roomId) {
          endRoom(io, roomId, { reason: 'ended', by: socket.id })
        }
      })

      socket.on('disconnect', () => {
        socket.data.wantsQueue = false
        removeFromQueue(socket)
        if (socket.data.userId && onlineByUser.get(socket.data.userId) === socket.id) {
          onlineByUser.delete(socket.data.userId)
        }
        if (socket.data.roomId) endRoom(io, socket.data.roomId, { reason: 'disconnect', by: socket.id })
        emitQueueStats(io)
      })
    })

    // Periodic sweep: re-attempt matching once skip cooldowns expire.
    setInterval(() => {
      for (const key of queues.keys()) tryMatch(io, key)
    }, 5_000).unref()

    httpServer.listen(port, hostname, () => {
      console.log(`> Nagrek ready on http://${hostname}:${port} (${dev ? 'development' : 'production'})`)
    })
  })
  .catch((error) => {
    console.error('Failed to start Nagrek server', error)
    process.exit(1)
  })
