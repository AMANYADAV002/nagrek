# Run Nagrek without Supabase / Razorpay

Payment + Supabase can wait. Locally you still get:

- Hero → craving → **Demo video** (always)
- **Live video match** between two browsers on the same Wi‑Fi/LAN (same `npm run dev` server)
- **Friends** request/accept/call (in-memory; resets when Node restarts)
- Social handles on profile (saved in browser localStorage)
- Legal pages, waitlist form, ambassador form

## Start

```bash
npm install
npm run dev
```

Open **http://localhost:3000** (and a second browser/Incognito for two-user video).

1. Click **Find a meal buddy** (auto guest when Supabase unset)
2. Pick a craving → allow camera
3. Second browser: same steps → you should match
4. Accept → video clears blur → chat over WebRTC
5. **Add friend** → other user accepts in Friends → **Call** works when both online

## What you must provide later (owner steps)

### A) Real multi-network video (phones / different ISPs) — recommended

WebRTC needs TURN. Without it, many mobile matches fail.

1. Get free/paid TURN (e.g. [Metered.ca](https://www.metered.ca/tools/openrelay/), Twilio, or self-host coturn — see `HOSTINGER-DEPLOY.md`)
2. Create `.env.local` (never paste secrets in chat):

```
TURN_URL=turn:your-host:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

3. Restart `npm run dev`

### B) Persistent accounts / friends / ratings DB — when ready

1. Create a free project at [supabase.com](https://supabase.com)
2. SQL editor → run files in order: `supabase/migrations/001` … `006`
3. Put into `.env.local` (dashboard → Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Auth → enable Google + Email magic link; add redirect `http://localhost:3000`
5. Restart server

### C) Payments — later only

Leave Razorpay vars empty. Paywall stays bypassed until you set keys.

## Limits without Supabase

- Friends/graph live only while `server.js` is running
- No cloud login / RLS / match history persistence
- Two users must hit the **same** Node process (same machine/port)
