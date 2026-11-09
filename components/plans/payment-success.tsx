"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientLink } from "@/components/glass/gradient-button";
import { formatInr, getPlan } from "@/lib/config/plans";
import { fireConfetti } from "@/lib/confetti";
import { useSession } from "@/lib/mock/session";

export function PaymentSuccess() {
  const session = useSession();
  const plan = getPlan(session?.plan);

  useEffect(() => {
    fireConfetti();
  }, []);

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", duration: 0.7 }}>
        <GlassCard strong className="max-w-md space-y-5 p-9 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 260 }}>
            <CheckCircle2 className="mx-auto size-16 text-peach" aria-hidden />
          </motion.div>
          <h1 className="text-3xl font-medium">You&apos;re in!</h1>
          <p className="text-sm text-soft">
            Your <strong className="text-cream">{plan?.name}</strong> plan is active
            {plan ? ` — ${formatInr(plan.priceInr)}/month (placeholder)` : ""}. A receipt is on its way to {session?.user?.email}.
          </p>
          <GradientLink href="/profile" size="lg" className="w-full">
            Set up your profile <ArrowRight />
          </GradientLink>
          <GradientLink href="/dashboard" variant="ghost" size="sm">
            Skip to the dashboard
          </GradientLink>
        </GlassCard>
      </motion.div>
    </main>
  );
}
