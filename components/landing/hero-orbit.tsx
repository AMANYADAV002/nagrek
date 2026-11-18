"use client";

import Image from "next/image";
import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cravings } from "@/lib/data/cravings";

type Layer = { pointerX: MotionValue<number>; pointerY: MotionValue<number>; scrollY: MotionValue<number> };

/** Pointer and scroll offset for one card; deeper cards move further. */
function useDepth({ pointerX, pointerY, scrollY }: Layer, depth: number) {
  const x = useTransform(pointerX, (v) => v * depth * 28);
  const py = useTransform(pointerY, (v) => v * depth * 28);
  const sy = useTransform(scrollY, (v) => -v * depth * 0.18);
  const y = useTransform([py, sy], ([a, b]) => (a as number) + (b as number));
  return { x, y };
}

function FoodCard({
  layer,
  depth,
  className,
  delay,
  rotate,
  float,
  image,
  label,
  priority,
  sizes,
}: {
  layer: Layer;
  depth: number;
  className: string;
  delay: number;
  rotate: number;
  float: number;
  image: string;
  label: string;
  priority?: boolean;
  sizes: string;
}) {
  const style = useDepth(layer, depth);
  return (
    <motion.div style={style} className={`absolute ${className}`}>
      <div className="enter-card size-full" style={{ "--d": `${delay}ms`, "--r": `${rotate}deg` } as React.CSSProperties}>
        <div className="drift size-full" style={{ "--t": `${float}s`, "--d": `${delay}ms` } as React.CSSProperties}>
          <div className="glass group relative size-full overflow-hidden rounded-[1.75rem] p-2 shadow-2xl transition-transform duration-500 hover:scale-[1.04]">
            <div className="relative size-full overflow-hidden rounded-[1.35rem]">
              <Image src={image} alt="" fill sizes={sizes} preload={priority} loading="eager" className="object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
            <span className="absolute bottom-5 left-6 text-[9px] font-bold tracking-[0.2em] [text-shadow:0_2px_8px_#000]">{label}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function HeroOrbit() {
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, { stiffness: 80, damping: 18 });
  const pointerY = useSpring(rawY, { stiffness: 80, damping: 18 });
  const { scrollY: pageY } = useScroll();
  const still = useMotionValue(0);
  const scrollY = reduce ? still : pageY;
  const layer = { pointerX, pointerY, scrollY };
  const badge = useDepth(layer, 1.4);
  const ring = useTransform(pointerX, (v) => v * 10);

  useEffect(() => {
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      rawX.set(e.clientX / window.innerWidth - 0.5);
      rawY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, rawX, rawY]);

  return (
    <div aria-hidden className="relative mx-auto mt-12 aspect-square w-full max-w-[min(92vw,540px)] shrink-0 lg:mt-0 lg:w-[42%]">
      <motion.div style={{ x: ring }} className="absolute inset-[4%] rounded-full border border-peach/10" />
      <div className="spin-slow absolute inset-[18%] rounded-full border border-dashed border-peach/15" style={{ "--t": "80s" } as React.CSSProperties}>
        <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-peach shadow-[0_0_14px_#ff936f]" />
      </div>
      <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,#ff7e5f2e,transparent_70%)] blur-2xl" />

      <FoodCard
        layer={layer}
        depth={0.6}
        className="top-[2%] right-[2%] aspect-square w-[58%]"
        delay={250}
        rotate={9}
        float={7}
        image={cravings[0].image}
        label="01 / PIZZA"
        priority
        sizes="(max-width: 1024px) 55vw, 320px"
      />
      <FoodCard
        layer={layer}
        depth={1.1}
        className="top-[10%] left-[2%] aspect-square w-[30%]"
        delay={420}
        rotate={-8}
        float={8.5}
        image={cravings[1].image}
        label="02 / SUSHI"
        sizes="(max-width: 1024px) 30vw, 170px"
      />
      <FoodCard
        layer={layer}
        depth={0.9}
        className="bottom-[5%] left-[8%] aspect-square w-[40%]"
        delay={560}
        rotate={-11}
        float={6.5}
        image={cravings[2].image}
        label="03 / COFFEE"
        sizes="(max-width: 1024px) 40vw, 220px"
      />

      <motion.div style={badge} className="absolute right-0 bottom-[18%]">
        <div className="enter-pop" style={{ "--d": "900ms" } as React.CSSProperties}>
          <div className="glass-strong flex -rotate-5 items-center gap-3 rounded-2xl px-4 py-3 text-[11px] leading-relaxed sm:px-5 sm:py-4 sm:text-xs">
            <span className="relative flex size-2">
              <span className="animate-pulse-ring absolute inset-0 rounded-full bg-peach" />
              <span className="relative size-2 rounded-full bg-peach shadow-[0_0_10px_#ff936f]" />
            </span>
            <span>
              Same craving.
              <br />
              <strong className="text-peach">Different stories.</strong>
            </span>
            <Sparkles className="size-4 text-peach" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
