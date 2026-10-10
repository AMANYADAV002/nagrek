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
const dev = process.env.NODE_ENV === 'development'
if (!dev) process.env.NODE_ENV = 'production'
const port = Number.parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOST || '0.0.0.0'

/** Allowed food ids. Anything else sent by a client is rejected. */
const FOODS = new Set(['pizza', 'sushi', 'coffee', 'burger'])
/** Regions must be short, printable strings. */
const REGION_PATTERN = /^[\w\s\-—,.&()]{1,48}$/u
/** How long two users who skipped each other are kept apart (ms). */
const SKIP_COOLDOWN_MS = 20_000
/** Safety net: a pending match that is never resolved gets torn down. */
const MATCH_DECISION_TIMEOUT_MS = 30_000

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
  }
  return iceServers
}

/* ------------------------------------------------------------------ */
/* Matchmaking state (in memory — resets when the process restarts)    */
/* ------------------------------------------------------------------ */

/** queueKey -> array of socket ids waiting (FIFO) */
const queues = new Map()
/** roomId -> { id, a, b, accepted:Set, timer } */
const rooms = new Map()

const queueKey = (region, food) => `${region.toLowerCase()}::${food}`

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
}

function recentlySkipped(socketA, socketB) {
  const now = Date.now()
  const a = socketA.data.skips.get(socketB.id)
  const b = socketB.data.skips.get(socketA.id)
  return (a && now - a < SKIP_COOLDOWN_MS) || (b && now - b < SKIP_COOLDOWN_MS)
}

/**
 * Put a socket in its queue and immediately try to pair it.
 * Guards against duplicate joins: a socket can be in at most one
 * queue OR one room at any time.
 */
function enqueue(io, socket) {
  const { region, food } = socket.data
  if (!region || !food) return
  if (socket.data.roomId) return // already matched

  removeFromQueue(socket)
  const key = queueKey(region, food)
  const list = queues.get(key) || []
  if (!list.includes(socket.id)) list.push(socket.id)
  queues.set(key, list)
  socket.data.queueKey = key

  socket.emit('queued', { region, food, waiting: list.length })
  tryMatch(io, key)
}

/** Pair the first two compatible sockets of a queue. */
function tryMatch(io, key) {
  const list = queues.get(key)
  if (!list || list.length < 2) return

  for (let i = 0; i < list.length; i++) {
    const first = io.sockets.sockets.get(list[i])
    if (!first) continue
    for (let j = i + 1; j < list.length; j++) {
      const second = io.sockets.sockets.get(list[j])
      if (!second || recentlySkipped(first, second)) continue
      createRoom(io, first, second)
      return tryMatch(io, key) // more pairs may be possible
    }
  }
}

function createRoom(io, a, b) {
  removeFromQueue(a)
  removeFromQueue(b)

  const roomId = `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const room = {
    id: roomId,
    a: a.id,
    b: b.id,
    accepted: new Set(),
    timer: setTimeout(() => endRoom(io, roomId, { reason: 'timeout' }), MATCH_DECISION_TIMEOUT_MS),
  }
  rooms.set(roomId, room)
  a.data.roomId = roomId
  b.data.roomId = roomId

  // `a` creates the WebRTC offer, `b` answers.
  a.emit('match-found', { roomId, initiator: true, region: a.data.region, food: a.data.food })
  b.emit('match-found', { roomId, initiator: false, region: b.data.region, food: b.data.food })
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

  // Remember skips so the same pair is not instantly re-matched.
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
    s.emit(event, { reason, byPartner: Boolean(by) && s.id !== by })
  }

  // Requeue on the next tick so clients can clean up their peer connection first.
  setTimeout(() => {
    for (const s of sockets) {
      if (s.connected && s.data.wantsQueue) enqueue(io, s)
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

    const iceServers = buildIceServers()

    io.on('connection', (socket) => {
      socket.data.region = null
      socket.data.food = null
      socket.data.queueKey = null
      socket.data.roomId = null
      socket.data.wantsQueue = false
      socket.data.skips = new Map()

      socket.emit('config', { iceServers })

      socket.on('join-queue', (payload = {}) => {
        const food = String(payload.food || '')
        const region = String(payload.region || 'Global').trim()
        if (!FOODS.has(food) || !REGION_PATTERN.test(region)) {
          socket.emit('error-message', { message: 'Invalid craving or region.' })
          return
        }
        // Duplicate join while matched: ignore.
        if (socket.data.roomId) return
        socket.data.food = food
        socket.data.region = region
        socket.data.wantsQueue = true
        enqueue(io, socket)
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
        if (!roomId || socket.data.roomId !== roomId) return
        endRoom(io, roomId, { reason: reason === 'timeout' ? 'timeout' : reason === 'failed' ? 'failed' : 'skip', by: socket.id })
      })

      socket.on('disconnect', () => {
        socket.data.wantsQueue = false
        removeFromQueue(socket)
        if (socket.data.roomId) endRoom(io, socket.data.roomId, { reason: 'disconnect', by: socket.id })
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
