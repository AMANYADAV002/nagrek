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

- **Mock session in localStorage** (`lib/mock/session.ts`, key `nagrek.session.v1`), read through `useSyncExternalStore`. Every screen reads and writes this one store, so the whole flow is clickable and survives reloads. "Sign out" resets the demo.
- **Route guards are client-side** in Phase 1 (`components/guard.tsx`), using a pure `redirectFor()` in `lib/guards.ts`. The proxy cannot read localStorage, so `proxy.ts` is a pass-through with `TODO(phase-2)`. The same `redirectFor()` rules will run in `proxy.ts` with the Supabase session.
- **Supabase clients exist but return `null`** when env vars are missing, so nothing breaks without keys.
- **Video room uses your real camera/mic locally** (permission, denied and unavailable states), and a mock remote participant. The signalling contract for N participants is in `lib/webrtc/types.ts`.
- **Music is a Web Audio synth** (`lib/audio/synth.ts`) with piano, violin, soft and cafe presets, so no music licensing is needed for the prototype. Tracks accept an optional `src` for licensed files later. "Share music with partner" is a stub (Phase 5).
- **Stories**: images are compressed client-side to a 1080px JPEG data URL and persisted. Videos (≤30s, ≤50 MB) use blob URLs and only last for the current page load. Real storage is Phase 4.

## Product defaults

- **Plan prices are placeholders**: Plus ₹199, Premium ₹499, Ultra ₹999 per month, all in `lib/config/plans.ts`. Daily matches are 5, 20 and unlimited.
- **Matching** (`lib/matching/score.ts`): weights are food 0.40, distance 0.25, tone 0.15, dietary 0.08, budget 0.07, language 0.05. Three hard filters apply: compatible tone ("No preference" matches anyone), at least one shared food (or the live craving), and a maximum distance of 15 km. Without coordinates, people in the same city get half distance credit.
- **Live requests** expire after 15 minutes. When fewer than 2 live matches exist, Nagrek pings up to 5 suitable users to "join" instead.
- **Streak rule** (`lib/streak/calc.ts`): a day counts when the user completes a meeting or accepts a join request. The streak is the run of consecutive counting days ending today or yesterday, and it resets every calendar month. Milestones are at 3, 7, 15 and 30 days.
- **Rewards**: eligibility checks claimed, expired, out of stock, plan rank, then streak. **Coupon codes never reach the client.** Claiming in Phase 1 only records the claim, and server-side issuance is `TODO(phase-6)`.
- **Location privacy**: coordinates are rounded to 2 decimals (about 1 km) before storage, and other users only see area and city.
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
