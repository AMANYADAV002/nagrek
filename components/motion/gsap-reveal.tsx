"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-triggered reveal for sections marked `data-reveal`; their `data-reveal-item`
 * children stagger in after the section. `data-parallax="12"` drifts an element
 * 12% against the scroll. GSAP + ScrollTrigger are loaded lazily so they stay out
 * of the first bundle.
 */
export function GsapReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((section) => {
          const items = section.querySelectorAll<HTMLElement>("[data-reveal-item]");
          const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: "top 85%", once: true } });
          tl.from(section, { y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });
          if (items.length) {
            tl.from(items, { y: 36, opacity: 0, scale: 0.96, duration: 0.7, stagger: 0.08, ease: "power3.out", clearProps: "transform" }, "-=0.55");
          }
        });
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((node) => {
          gsap.fromTo(
            node,
            { yPercent: Number(node.dataset.parallax) || 10 },
            { yPercent: -(Number(node.dataset.parallax) || 10), ease: "none", scrollTrigger: { trigger: node, start: "top bottom", end: "bottom top", scrub: true } },
          );
        });
      }, el);
      ScrollTrigger.refresh();
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
