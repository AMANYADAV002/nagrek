"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GradientButton } from "@/components/glass/gradient-button";
import { cravingEmoji } from "@/lib/data/cravings";
import { updateSession, useSession } from "@/lib/mock/session";

const AUTO_ADVANCE_MS = 6500;
const words = ["Welcome", "to", "the", "new", "world", "experience"];

export function WelcomeExperience() {
  const router = useRouter();
  const session = useSession();
  const foods = session?.preferences?.foodInterests.slice(0, 6) ?? [];

  useEffect(() => {
    const t = setTimeout(() => go(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go() {
    updateSession({ welcomed: true });
    router.push(session?.plan ? "/dashboard" : "/plans");
  }

  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* expanding rings */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute rounded-full border border-peach/25"
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{ width: 1400, height: 1400, opacity: 0 }}
          transition={{ duration: 4, delay: i * 1.1, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
      <motion.div
        aria-hidden
        className="absolute size-[30rem] rounded-full bg-[radial-gradient(ellipse,#ff7e5f55,transparent_65%)] blur-2xl"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* floating food */}
      {foods.map((f, i) => (
        <motion.span
          key={f}
          aria-hidden
          className="absolute text-4xl md:text-5xl"
          style={{ left: `${12 + ((i * 17) % 76)}%`, top: `${15 + ((i * 29) % 65)}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.85, scale: 1, y: [0, -16, 0] }}
          transition={{ delay: 1.4 + i * 0.15, y: { duration: 4 + i, repeat: Infinity } }}
        >
          {cravingEmoji[f] ?? "🍽️"}
        </motion.span>
      ))}

      <h1 className="relative max-w-4xl font-heading text-[clamp(2.6rem,8vw,6rem)] leading-[1.02] font-medium tracking-[-0.04em]">
        {words.map((w, i) => (
          <motion.span
            key={w}
            className={i >= 3 ? "mr-[0.25em] inline-block text-brand" : "mr-[0.25em] inline-block"}
            initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.2 + i * 0.14, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
          </motion.span>
        ))}
      </h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="relative mt-6 max-w-md text-soft"
      >
        {session?.user ? `${session.user.name.split(" ")[0]}, your` : "Your"} table is set. Let&apos;s find people who are hungry for the same things.
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="relative mt-10">
        <GradientButton size="lg" onClick={go}>
          Continue <ArrowRight />
        </GradientButton>
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute bottom-0 left-0 h-1 bg-brand"
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: "linear" }}
      />
    </main>
  );
}
