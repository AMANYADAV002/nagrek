# Decisions log

Defaults chosen without asking, per the brief ("make sensible defaults, list them here"). Each one is easy to revisit.

## Platform

| Decision | Why |
| --- | --- |
| **Next.js 16 (App Router, Turbopack), React 19, TypeScript strict** | Latest stable at scaffold time. Note the Next 16 changes: `middleware.ts` is now `proxy.ts`, `params`/`searchParams` are async, `next lint` is gone (we run `eslint` directly). Route types come from `next typegen` (`PageProps<'/route'>`). |
| **Tailwind v4 + shadcn/ui "base-nova" style** | shadcn's current default is built on **Base UI** (`@base-ui/react`) rather than Radix. APIs differ slightly (e.g. `Slider.onValueChange(number \| number[])`). |
| **Glass components built in-house** (`components/glass/*`) | 21st.dev MCP charges per component fetch, and the needs (glass card, gradient button, chip) are small. Swap in 21st.dev pieces later if wanted. |
| **Framer Motion for UI, GSAP only for scroll reveals** | GSAP + ScrollTrigger are lazy-loaded on the landing page only. All motion respects `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` + a CSS override). |
| **Hostinger target: plain Node.js server** (`next build && next start`) | No Vercel-only features are used. See README for the deploy and zip-export steps. |

## Phase 1 architecture

- **Mock session in localStorage** when `NEXT_PUBLIC_SUPABASE_URL` is unset (`lib/mock/session.ts`). Set the Supabase keys and the same screens read and write Postgres instead; the demo keeps working with no project.
- **Route guards:** client `<Guard>` always, and `proxy.ts` as well once Supabase is configured. Both use `redirectFor()` in `lib/guards.ts`.
- **Supabase clients return `null`** when env vars are missing.
- **Demo mode keeps working.** Without Supabase keys, every screen uses demo people and stores state in the browser. With keys, the same screens use the server actions described below.
- **Music is a Web Audio synth** (`lib/audio/synth.ts`) with piano, violin, soft and cafe presets, so no music licensing is needed for the prototype. Tracks accept an optional `src` for licensed files later. Each person hears their own music; "share music with partner" is still a stub.

## Product defaults

- **Plan prices are placeholders**: Plus ₹199, Premium ₹499, Ultra ₹999 per month, all in `lib/config/plans.ts`. Daily matches are 5, 20 and unlimited.
- **Matching** (`lib/matching/score.ts`): weights are food 0.40, distance 0.25, tone 0.15, dietary 0.08, budget 0.07, language 0.05. Three hard filters apply: compatible tone ("No preference" matches anyone), at least one shared food (or the live craving), and a maximum distance of 15 km. Without coordinates, people in the same city get half distance credit.
- **Live requests** expire after 15 minutes. When fewer than 2 live matches exist, Nagrek pings up to 5 suitable users to "join" instead.
- **Streak rule** (`lib/streak/calc.ts`): a day counts when the user completes a meeting or accepts a join request. The streak is the run of consecutive counting days ending today or yesterday, and it resets every calendar month. Milestones are at 3, 7, 15 and 30 days.
- **Rewards**: eligibility checks claimed, expired, out of stock, plan rank, then streak. **Coupon codes never reach the client bundle.** `claim_reward()` (service role only) locks one unused code with `skip locked`, decrements stock and records the claim; the code is returned only to the person who claimed it.
- **Plans are 30-day passes, not auto-renewing subscriptions.** Each payment is a Razorpay Order that grants 30 days (`profiles.plan_expires_at`). Paying again for the same active plan extends it; switching plans starts a fresh 30 days, and leftover days are not credited. Razorpay Subscriptions (e-mandate auto-debit) need plans created in the Razorpay dashboard and RBI mandate handling, so they are deferred: `TODO(phase-7)`.
- **Prices come from the database.** `startCheckout` reads `plans` / `avatar_items` with the service role and creates the order server-side. The browser never sends an amount.
- **Two confirmation paths, one fulfilment.** The checkout handler's signature is verified in `confirmCheckout`, and the webhook (`/api/razorpay/webhook`, raw-body HMAC) covers closed tabs. Both call `fulfill_payment()`, which locks the payment row, checks the amount, and is idempotent. Only the service role can execute it.
- **Free preview (current setting).** With no Razorpay keys and `NEXT_PUBLIC_FREE_PREVIEW=true`, plans and avatar items are free: "checkout" records a ₹0 `mock` payment and runs the same `fulfill_payment()`, so passes still last 30 days and every rule is exercised. Without the flag, mock checkout runs only in `next dev`, and production refuses payments. Adding Razorpay keys switches to real checkout automatically; set the flag to `false` at the same time.
- **Grants reset in Phase 3.** Supabase grants new tables to `anon` and `authenticated` by default, so the first migration's grants were mostly no-ops and RLS was the only barrier. The payments migration revokes everything and re-grants only what the app uses. Clients can no longer write `user_avatar_inventory`, `streaks`, or `profiles.avatar`; avatars save through `save_avatar()`, which checks purchases, plan unlocks and streak unlocks.
- **Streaks are server-side.** Only `endMeeting` writes `streak_events` (once per meeting per person, and only if the call lasted at least 60 seconds after both browsers connected), then recomputes `streaks.current_count` in India time. Clients cannot insert streak events, feedback, reports, stories, reward claims or match requests directly.
- **Finishing onboarding** goes through `complete_onboarding()`, which sets `profiles.onboarded_at` only after an accepted consent row exists. Clients cannot write `onboarded_at`, so the 18+ and conduct agreement cannot be skipped.
- **Email confirmation stays on.** Confirmation links land on `/auth/callback`. `npm run check:supabase` uses the secret key to create a pre-confirmed throwaway user for testing.
- **Demo people** (`u-aisha` and the rest) are not database users. Follows, connections and invites aimed at them stay on this device. The same buttons persist once the other person has a real account (a uuid).
- **Exact location and date of birth** are stored only in `user_preferences`, which the owner can read. Public profiles carry city and area. Coupon codes sit in `reward_codes` with no client policy.
- **18+ gate**: date of birth is validated with Zod, and two confirmations are required. Consent is stored with a timestamp and `TERMS_VERSION` (`2026-11-draft-1`).
- **Calls are never recorded.** A meeting becomes a story only if both people consent on the feedback screen.
- **Avatar items**: basic items are free and premium items are one-time ₹19–₹99 purchases. Some items unlock with a 7, 15 or 30 day streak or the Ultra plan.
- **Admin pages** require `profiles.role = 'admin'` when Supabase is on: the layout returns 404 to everyone else, and every admin action checks the role again. Promote someone with the SQL at the bottom of `20261109060000_admin.sql`. Demo mode lets any signed-in user open the demo admin pages.

## Phases 4–7 (live backend)

- **Matching runs on the server** (`lib/actions/matching.ts`). Nobody can list other people's cravings: requests are readable only by their owner, and candidates are scored with the service role. Distances shown to users are rounded to whole kilometres, and only city and area are shared.
- **Match decisions**: each side has 45 seconds to accept or skip. Pre-meet stays blurred until both accept. Updates arrive over Realtime with a 4-second poll as a fallback.
- **Join pings**: when fewer than 2 live matches exist, up to 5 people who list that food get a notification. Each person receives at most 3 pings a day. Accepting one is an atomic claim, so only one person can join a request.
- **Video calls are peer-to-peer WebRTC.** Signalling runs on a private Supabase Realtime channel `room:<matchId>`. RLS on `realtime.messages` lets in only the two participants of a live match. The person who started the match makes the offer, and a failed connection retries with an ICE restart. STUN defaults to Google's public servers. TURN (`TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`) is handed only to participants. Without TURN, roughly 10–20% of networks (strict NAT, some mobile carriers) won't connect: `TODO(phase-7)` short-lived TURN credentials.
- **Nothing is recorded.** Media goes browser to browser (or through TURN, encrypted), and the server stores only start and end times.
- **Trust score** = (sum of the last 50 ratings + 3 × 5) / (count + 3). The three virtual 5-star ratings stop one bad review from sinking a new member.
- **Stories** go into a private Storage bucket (`stories`, 50 MB, images and MP4/WebM/MOV only). Each person uploads into their own folder. The server then checks the file, the 10-a-day limit and, for meeting stories, the partner's consent, before publishing. Files are viewed through signed URLs that last 1 hour, and nobody can list or download files directly. Deleting an account deletes its story files.
- **Meeting stories need the partner's consent**: a request notification is sent, and the partner chooses Agree or No thanks. The server refuses to publish a meeting story without a granted consent row.
- **Reward codes**: until real sponsors sign up, the migration adds 25 placeholder codes per reward, clearly prefixed `NAGREK-DEMO-`. Stock equals the number of unclaimed codes. Admins add real codes on `/admin/rewards`; codes are never shown back in the admin UI.
- **Leaderboard is opt-in** (`profiles.show_on_leaderboard`) and shows first names only.
- **People lists use real accounts in live mode.** Connections, discover, wish-list friends and profile pages load public profile fields only, never coordinates, date of birth, diet or budget. Anyone who blocked you is hidden. Demo people still appear for actions you took while in demo mode.
- **Places on Explore are a curated seed list** (`lib/mock/places.ts`), not user data. A `places` table or Google Places integration can come later.
- **Moderation**: reports are reviewed on `/admin/reports`. The actions are dismiss, hide story, warn (sends a notification) and suspend (hides their stories, cancels open requests, and blocks matching through `getMember`). Every decision is written to `moderation_actions`, which only the server can read.

## Security (Phase 7)

- **Headers** (`next.config.ts`): a Content Security Policy limited to this site, Supabase and Razorpay Checkout; `X-Frame-Options: DENY`; `nosniff`; a strict referrer policy; a Permissions-Policy allowing only camera, mic, location and payment; HSTS in production. `'unsafe-inline'` scripts are allowed because Next.js injects inline bootstrap scripts. A nonce-based CSP is a later hardening step.
- **Rate limits**: daily limits are stored in the database (matches by plan, 3 pings a day, 10 stories a day, 10 reports a day). On top of these, an in-memory burst limiter (`lib/server/rate-limit.ts`) covers cravings, stories, story consent, reports and reward claims. It suits a single Node process; use Redis or another shared store if you run several.
- **Health check**: `/api/health` reports database reachability and which integrations are configured, never their values.
- **SEO**: `robots.txt` allows only the landing, sign-up/sign-in and legal pages, and `sitemap.xml` lists them. Set `NEXT_PUBLIC_SITE_URL` to the real domain.

## Ported from the original nagrek.com zip

Brand palette (`#ff7e5f → #feb47b` on ink), fonts (Space Grotesk headings, Manrope body, Caveat accents), the hero orbit layout, the craving images (served from `images.hostinger.com`), the cities marquee, the FAQ, and the privacy and terms text (rewritten into `lib/data/legal.ts`). **The legal text is a draft and needs lawyer review** (`TODO(legal-review)`).

## Process notes

- Tailwind runs through the `@tailwindcss/turbopack` loader registered in `next.config.ts` (there is no PostCSS config). `turbopack.root` is pinned to the project because a stray `package-lock.json` in the home folder otherwise makes Turbopack resolve modules from the wrong root.
- `npm install` needs `--legacy-peer-deps` (vitest 5 and some peer ranges lag React 19 / Next 16). `vite` is installed explicitly for the same reason.
- During Phase 1 a second agent briefly wrote into this folder and overwrote a few config files. Its files were removed and the originals restored, so the tree reflects a single design.
