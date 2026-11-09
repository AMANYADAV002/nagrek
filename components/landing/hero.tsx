"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, ArrowLeftRight, ArrowUpRight, Sparkles, Video } from "lucide-react";
import { GradientLink } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";
import { cravings } from "@/lib/data/cravings";
import { motion as tokens } from "@/lib/design-tokens";

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100dvh-6rem)] max-w-[1440px] flex-col justify-center overflow-hidden px-[6%] pt-12 pb-28 lg:flex-row lg:items-center">
      <div aria-hidden className="absolute -top-16 -right-20 -z-10 size-[40rem] rounded-full bg-[radial-gradient(ellipse,#ff7e5f26,transparent_67%)]" />

      <div className="relative z-10 lg:w-[58%]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Eyebrow>Good food. Real connections.</Eyebrow>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: tokens.base, ease: tokens.ease }}
          className="glass mt-6 inline-flex items-center gap-3 rounded-full px-4 py-2 font-heading text-sm"
        >
          Talk <ArrowLeftRight className="size-4 text-peach" aria-label="and" /> Eat
        </motion.p>

        <h1 className="mt-6 font-heading text-[clamp(3.6rem,9vw,7rem)] leading-[0.98] font-medium tracking-[-0.05em]">
          {["Never eat", "alone."].map((line, i) => (
            <span key={line} className="block overflow-hidden pb-1">
              <motion.span
                className={i === 1 ? "block text-brand" : "block"}
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: tokens.slow, delay: 0.15 + i * 0.13, ease: tokens.ease }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-5 max-w-md text-base leading-relaxed text-soft"
        >
          <span className="block font-medium text-cream">Connection is on the menu.</span>
          Match with someone nearby who is craving the same thing, say hi on a quick live video, then share a table.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <GradientLink href="/sign-up" size="lg">
            Start eating together <ArrowUpRight />
          </GradientLink>
          <GradientLink href="#how-it-works" variant="outline" size="lg">
            How it works
          </GradientLink>
        </motion.div>
        <p className="mt-5 flex items-center gap-2 text-xs text-soft">
          <Video className="size-3.5 text-peach" aria-hidden /> Live video. Shared cravings. 18+ only.
        </p>
      </div>

      {/* Food orbit, ported from the original landing */}
      <div aria-hidden className="relative mx-auto mt-14 h-[420px] w-[340px] shrink-0 sm:w-[440px] lg:mt-0 lg:h-[540px] lg:w-[520px]">
        <div className="absolute inset-6 rounded-full border border-peach/10" />
        <div className="absolute inset-24 rounded-full border border-dashed border-peach/10" />
        <motion.div
          initial={{ opacity: 0, rotate: 0, y: 30 }}
          animate={{ opacity: 1, rotate: 9, y: 0 }}
          transition={{ delay: 0.3, duration: tokens.slow, ease: tokens.ease }}
          className="glass absolute top-6 right-2 h-56 w-56 overflow-hidden rounded-3xl p-2 lg:h-80 lg:w-80"
        >
          <div className="relative size-full overflow-hidden rounded-2xl">
            <Image src={cravings[0].image} alt="" fill sizes="320px" className="object-cover" priority />
          </div>
          <span className="absolute bottom-5 left-6 text-[9px] font-bold tracking-[0.2em] [text-shadow:0_2px_8px_#000]">01 / PIZZA</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, rotate: 0, y: 30 }}
          animate={{ opacity: 1, rotate: -11, y: 0 }}
          transition={{ delay: 0.45, duration: tokens.slow, ease: tokens.ease }}
          className="glass absolute bottom-8 left-0 h-40 w-40 overflow-hidden rounded-3xl p-2 lg:h-52 lg:w-52"
        >
          <div className="relative size-full overflow-hidden rounded-2xl">
            <Image src={cravings[2].image} alt="" fill sizes="210px" className="object-cover" />
          </div>
          <span className="absolute bottom-5 left-6 text-[9px] font-bold tracking-[0.2em] [text-shadow:0_2px_8px_#000]">03 / COFFEE</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, rotate: -5 }}
          transition={{ delay: 0.75, type: "spring" }}
          className="glass-strong absolute right-0 bottom-24 flex items-center gap-3 rounded-2xl px-5 py-4 text-xs leading-relaxed"
        >
          <span className="size-1.5 rounded-full bg-peach shadow-[0_0_10px_#ff936f]" />
          <span>
            Same craving.
            <br />
            <strong className="text-peach">Different stories.</strong>
          </span>
          <Sparkles className="size-4 text-peach" />
        </motion.div>
      </div>

      <div className="absolute inset-x-[6%] bottom-6 flex items-center justify-between border-t border-white/8 pt-5 text-[9px] tracking-[0.15em] text-soft">
        <span className="hidden sm:inline">LESS SCROLLING. MORE SHARING.</span>
        <a href="#cravings" className="mx-auto flex items-center gap-2 text-xs tracking-normal hover:text-peach sm:mx-0">
          Find your table <ArrowDown className="size-4" />
        </a>
        <span className="hidden sm:inline">EST. FOR TOGETHERNESS</span>
      </div>
    </section>
  );
}
