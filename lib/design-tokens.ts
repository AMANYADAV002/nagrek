/**
 * Single source of truth for Nagrek's visual language. The same values are
 * mirrored as CSS variables / Tailwind utilities in app/globals.css.
 */
export const colors = {
  ink: "#0b0c0f",
  ink2: "#121318",
  cream: "#f6f3ef",
  soft: "#a4a3a7",
  peach: "#ff936f",
  brandFrom: "#ff7e5f",
  brandTo: "#feb47b",
  line: "rgba(255,255,255,0.10)",
  success: "#4ade80",
  warning: "#fbbf24",
  danger: "#f87171",
} as const;

export const gradients = {
  brand: `linear-gradient(110deg, ${colors.brandFrom}, ${colors.brandTo})`,
  glass: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
  orb: `radial-gradient(ellipse, ${colors.brandFrom}22, transparent 67%)`,
} as const;

export const radii = { sm: 10, md: 14, lg: 16, xl: 22, pill: 999 } as const;

export const blur = { glass: 18, strong: 24, preview: 28 } as const;

export const shadows = {
  glass: "0 20px 60px -20px rgba(0,0,0,0.6)",
  glow: "0 8px 40px -6px rgba(255,126,95,0.45)",
} as const;

export const spacing = { page: "clamp(1rem, 4vw, 3rem)", section: "clamp(3rem, 8vw, 6rem)" } as const;

export const motion = {
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  fast: 0.2,
  base: 0.45,
  slow: 0.8,
  stagger: 0.08,
} as const;

export const tokens = { colors, gradients, radii, blur, shadows, spacing, motion };
export default tokens;
