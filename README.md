# Nagrek: Talk ⇄ Eat

"Never eat alone." Match with someone nearby who is craving the same food, meet over a short video call, then go eat together.

**Status: all 7 phases are built, running as a free preview.** With Supabase keys set, everything is real:
- accounts and onboarding
- live matching and join pings
- notifications
- peer-to-peer video calls
- streaks
- stories
- reward codes
- people lists
- moderation

Plans are free while `NEXT_PUBLIC_FREE_PREVIEW=true` and no Razorpay keys are set. Adding the keys turns on real checkout. With no keys at all, the full demo still runs in the browser. See `DECISIONS.md`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Framer Motion · GSAP · Zod · Vitest · Supabase (Auth, Postgres, RLS, Realtime, Storage) · WebRTC · Razorpay (Orders, Checkout, webhooks).

## Supabase (Phase 2)

The app runs the full demo with no keys. To persist accounts:

1. Create a project at [supabase.com](https://supabase.com). Under **Authentication → Providers**, keep Email on (with "Confirm email" on, new users confirm through the emailed link). Under **Authentication → URL Configuration**, set the Site URL and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local) to the redirect URLs. Add Google only if you have OAuth credentials.
2. In the SQL editor, run every file in `supabase/migrations/` in filename order, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) and `SUPABASE_SERVICE_ROLE_KEY` (the secret key, server only).
4. Run `npm run check:supabase` (or one section, e.g. `npm run check:supabase -- social`). It creates pre-confirmed throwaway users, then checks:
   - accounts and payments
   - matching privacy
   - call-channel access
   - storage rules
   - reward claims
   - admin-only fields

   It deletes the users and their files afterwards.
5. Restart `npm run dev`. Everything is stored under Row Level Security.
6. To open `/admin`, make yourself an admin in the SQL editor:
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`

## Video calls (Phase 5)

Calls are WebRTC. Supabase Realtime carries the connection setup, and nothing is recorded. STUN works out of the box. For people on strict networks (some mobile carriers, offices), run the coturn relay in `deploy/coturn/turnserver.conf` on a small VPS and set `TURN_URLS` and `TURN_SECRET`; the app hands each person 2-hour credentials. Set `TURN_FORCE_RELAY=true` to send all media through your relay so nobody learns anyone's IP address. To test a match call, open the app in two browsers (or one normal window and one private window) with two accounts, post the same craving, and accept the match on both.

### Calls, visits and the visit streak

- **Calls:** connections can voice or video call each other from People or a profile. People are addressed by their app user id only; no phone number is ever collected. Ringing, accept, decline and missed calls are rows in `calls`; signalling runs on the private channel `call:<id>`.
- **Visits:** plan an in-person visit from a call, a profile, or `/visits`. The other person accepts or declines.
- **Verification:** from 2 hours before to 6 hours after the planned time, each person opens "Verify meetup", shows a rotating QR code (new every 25 s, valid once for 45 s), and scans the other's. The server checks both phones' GPS fixes (precise to 100 m, under 2 minutes old, within 150 m of each other, no impossible travel). When both have scanned within 10 minutes, the visit is verified and both visit streaks go up in the same transaction.
- **Streak and rewards:** one counted visit per pair per 7 days and at most two per day; the streak resets after 30 days without one. Sponsor rewards unlock on the visit streak and are issued to both people automatically.
- Testing verification needs two phones (camera and GPS) on HTTPS, for example the deployed site or a tunnel to `localhost`.

## Razorpay (Phase 3)

Right now the app is a **free preview**: with `NEXT_PUBLIC_FREE_PREVIEW=true` and no Razorpay keys, choosing a plan activates it for free (a ₹0 record through the same database path). To start charging, follow these steps and set `NEXT_PUBLIC_FREE_PREVIEW=false`.

1. In the Razorpay dashboard (test mode), open **Account & Settings → API Keys**, generate a key, and put the Key ID in `NEXT_PUBLIC_RAZORPAY_KEY_ID` and the Key Secret in `RAZORPAY_KEY_SECRET`.
2. Under **Webhooks**, add `https://<your-domain>/api/razorpay/webhook` with the events `payment.captured`, `order.paid` and `payment.failed`, and put the secret you choose in `RAZORPAY_WEBHOOK_SECRET`. Webhooks cannot reach `localhost`; locally the checkout handler confirms payments on its own.
3. Restart the app. Test cards and UPI IDs are listed in Razorpay's test-mode docs.

`npm test` checks the matching and streak rules, and that every table in the migration has Row Level Security turned on.

## Getting started

Requires Node.js 20.9+.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # optional in Phase 1
npm run dev                  # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (matching, streak, rewards, guards, account mapping, RLS) |

### Demo walkthrough

1. On the landing page, click **Get started**, then sign up with any email (mock auth).
2. Complete onboarding: food, tone, location, taste, schedule, interests, then the 18+ and legal step.
3. On the welcome screen, pick a plan and pay through the mock Razorpay dialog. It can also simulate a failure.
4. On the dashboard, pick a craving and search. You'll get either live matches or the "ping and accept" low-traffic flow.
5. Go through pre-meet (blurred until both accept), the video room (real camera, mock partner, music), feedback, and story consent.
6. Also explore stories, streak and rewards, people, the wish list, places, and avatar studio. Admin pages are at `/admin`.

Use **Sign out** in the sidebar to reset the demo. The session lives in `localStorage`.

## Project layout

```
app/                 routes: (auth), onboarding, welcome, plans, (app) main screens,
                     (meeting) pre-meet/room/feedback, admin, legal
components/          glass/ motion/ brand/ layout/ + one folder per feature
lib/
  config/            plans, tracks, streak levels, avatar items  ← product knobs
  matching/          matching_score + live-request logic
  streak/            streak + reward eligibility
  mock/              mock users, stories, rewards, places, session store
  validation/        Zod schemas
  actions/           server actions (account, payments, matching, meeting, stories,
                     rewards, people, admin)
  payments/          Razorpay orders, signatures, checkout client, plan expiry
  server/            caller/member checks, burst rate limiter
  supabase/          browser, server and service-role clients
  webrtc/            signalling types + usePeer hook
proxy.ts             route protection (signed in → onboarded → active plan)
tests/               Vitest unit tests
```

Search for `TODO(phase-` to see every stubbed integration point.

## Deploying to Hostinger (Node.js)

1. In hPanel, open **Websites → Node.js**, create an app on Node 20+, and set the application root to this folder.
2. Upload the code using Git deploy or the zip described below.
3. Set the build command to `npm install --legacy-peer-deps && npm run build` and the start command to `npm start`. Hostinger provides `PORT`, and `next start` respects it.
4. Add the environment variables from `.env.example` in the panel:
   - `NEXT_PUBLIC_SITE_URL` (your domain)
   - the three Supabase keys
   - `NEXT_PUBLIC_FREE_PREVIEW`
   - optionally TURN (`TURN_URLS`, `TURN_SECRET`, `TURN_FORCE_RELAY`) and Razorpay

   `NEXT_PUBLIC_*` values are baked in at build time, so rebuild after changing them.
5. In Supabase **Authentication → URL Configuration**, add `https://<your-domain>/auth/callback`.
6. Point an uptime monitor at `https://<your-domain>/api/health`.

The burst rate limiter keeps its counters in memory, which suits Hostinger's single Node process. HTTPS is required for camera and mic access on any domain other than `localhost`.

## Exporting as a zip

Exclude dependencies and build output, which are rebuilt on the server:

```powershell
git archive --format=zip -o nagrek.zip HEAD
```

Or, without git, zip the folder excluding `node_modules`, `.next` and `.env*.local`.
