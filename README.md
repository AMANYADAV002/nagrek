# Nagrek: Talk ⇄ Eat

"Never eat alone." Match with someone nearby who is craving the same food, meet over a short video call, then go eat together.

**Status: Phase 2 backend is wired, and the Phase 1 demo still runs with no keys.** With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, accounts, onboarding, plans, profiles, follows, connections and the wish list persist in Supabase. Everything else (live matching, video, stories, streaks, payments) is still mocked. See `DECISIONS.md`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Framer Motion · GSAP · Zod · Vitest · Supabase (Auth, Postgres, RLS). Still mocked: Razorpay, WebRTC, live matching, stories storage, streak rewards.

## Supabase (Phase 2)

The app runs the full demo with no keys. To persist accounts:

1. Create a project at [supabase.com](https://supabase.com). Under **Authentication → Providers**, keep Email on (with "Confirm email" on, new users confirm through the emailed link). Under **Authentication → URL Configuration**, set the Site URL and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local) to the redirect URLs. Add Google only if you have OAuth credentials.
2. In the SQL editor, run every file in `supabase/migrations/` in filename order, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) and `SUPABASE_SERVICE_ROLE_KEY` (the secret key, server only).
4. Run `npm run check:supabase`. It creates a pre-confirmed throwaway user, checks sign-in, profile, consent-gated onboarding, plan protection and account deletion, then removes the user.
5. Restart `npm run dev`. Sign up creates a profile. Onboarding, the chosen plan, profile edits, follows, connections and the wish list are stored under Row Level Security.

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
  supabase/ webrtc/  Phase 2 / 5 stubs
proxy.ts             route protection (TODO phase-2)
tests/               Vitest unit tests
```

Search for `TODO(phase-` to see every stubbed integration point.

## Deploying to Hostinger (Node.js)

1. In hPanel, open **Websites → Node.js**, create an app on Node 20+, and set the application root to this folder.
2. Upload the code using Git deploy or the zip described below.
3. Set the build command to `npm install --legacy-peer-deps && npm run build` and the start command to `npm start`. Hostinger provides `PORT`, and `next start` respects it.
4. Add the environment variables from `.env.example` in the panel. None are required for Phase 1.

## Exporting as a zip

Exclude dependencies and build output, which are rebuilt on the server:

```powershell
git archive --format=zip -o nagrek.zip HEAD
```

Or, without git, zip the folder excluding `node_modules`, `.next` and `.env*.local`.
