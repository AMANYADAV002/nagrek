/** Brand-coloured confetti burst. Lazy-loaded and skipped for reduced motion. */
export async function fireConfetti(opts: { particleCount?: number; spread?: number } = {}) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: opts.particleCount ?? 140,
    spread: opts.spread ?? 80,
    origin: { y: 0.6 },
    colors: ["#ff7e5f", "#feb47b", "#f6f3ef", "#ff936f"],
  });
}
