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
- **Video room uses your real camera/mic locally** (permission, denied and unavailable states), and a mock remote participant. The signalling contract for N participants is in `lib/webrtc/types.ts`.
- **Music is a Web Audio synth** (`lib/audio/synth.ts`) with piano, violin, soft and cafe presets, so no music licensing is needed for the prototype. Tracks accept an optional `src` for licensed files later. "Share music with partner" is a stub (Phase 5).
- **Stories**: images are compressed client-side to a 1080px JPEG data URL and persisted. Videos (≤30s, ≤50 MB) use blob URLs and only last for the current page load. Real storage is Phase 4.

## Product defaults

- **Plan prices are placeholders**: Plus ₹199, Premium ₹499, Ultra ₹999 per month, all in `lib/config/plans.ts`. Daily matches are 5, 20 and unlimited.
- **Matching** (`lib/matching/score.ts`): weights are food 0.40, distance 0.25, tone 0.15, dietary 0.08, budget 0.07, language 0.05. Three hard filters apply: compatible tone ("No preference" matches anyone), at least one shared food (or the live craving), and a maximum distance of 15 km. Without coordinates, people in the same city get half distance credit.
- **Live requests** expire after 15 minutes. When fewer than 2 live matches exist, Nagrek pings up to 5 suitable users to "join" instead.
- **Streak rule** (`lib/streak/calc.ts`): a day counts when the user completes a meeting or accepts a join request. The streak is the run of consecutive counting days ending today or yesterday, and it resets every calendar month. Milestones are at 3, 7, 15 and 30 days.
- **Rewards**: eligibility checks claimed, expired, out of stock, plan rank, then streak. **Coupon codes never reach the client.** Claiming in Phase 1 only records the claim, and server-side issuance is `TODO(phase-6)`.
- **Choosing a plan before Razorpay** calls `activate_mock_plan()`, which writes a `subscriptions` row with `provider = 'mock'`. Phase 3 removes that function and lets only the webhook grant a plan.
- **Finishing onboarding** goes through `complete_onboarding()`, which sets `profiles.onboarded_at` only after an accepted consent row exists. Clients cannot write `onboarded_at`, so the 18+ and conduct agreement cannot be skipped.
- **Email confirmation stays on.** Confirmation links land on `/auth/callback`. `npm run check:supabase` uses the secret key to create a pre-confirmed throwaway user for testing.
- **Demo people** (`u-aisha` and the rest) are not database users. Follows, connections and invites aimed at them stay on this device. The same buttons persist once the other person has a real account (a uuid).
- **Exact location and date of birth** are stored only in `user_preferences`, which the owner can read. Public profiles carry city and area. Coupon codes sit in `reward_codes` with no client policy.
- **18+ gate**: date of birth is validated with Zod, and two confirmations are required. Consent is stored with a timestamp and `TERMS_VERSION` (`2026-11-draft-1`).
- **Calls are never recorded.** A meeting becomes a story only if both people consent on the feedback screen.
- **Avatar items**: basic items are free and premium items are one-time ₹19–₹99 purchases. Some items unlock with a 7, 15 or 30 day streak or the Ultra plan.
- **Admin pages** (`/admin/reports`, `/admin/rewards`) only require sign-in in Phase 1. A real admin role check is `TODO(phase-7)`.

## Ported from the original nagrek.com zip

Brand palette (`#ff7e5f → #feb47b` on ink), fonts (Space Grotesk headings, Manrope body, Caveat accents), the hero orbit layout, the craving images (served from `images.hostinger.com`), the cities marquee, the FAQ, and the privacy and terms text (rewritten into `lib/data/legal.ts`). **The legal text is a draft and needs lawyer review** (`TODO(legal-review)`).

## Process notes

- Tailwind runs through the `@tailwindcss/turbopack` loader registered in `next.config.ts` (there is no PostCSS config). `turbopack.root` is pinned to the project because a stray `package-lock.json` in the home folder otherwise makes Turbopack resolve modules from the wrong root.
- `npm install` needs `--legacy-peer-deps` (vitest 5 and some peer ranges lag React 19 / Next 16). `vite` is installed explicitly for the same reason.
- During Phase 1 a second agent briefly wrote into this folder and overwrote a few config files. Its files were removed and the originals restored, so the tree reflects a single design.
