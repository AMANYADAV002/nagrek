"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, CreditCard, Crown, Lock, Minus, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { GradientButton } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loadPlans, saveMockPlan } from "@/lib/actions/account";
import { comparisonRows, formatInr, plans as fallbackPlans, type Plan } from "@/lib/config/plans";
import { track } from "@/lib/analytics";
import { updateSession, useSession } from "@/lib/mock/session";
import { backendEnabled } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const icons = { plus: Zap, premium: Sparkles, ultra: Crown } as const;

export function PlansView() {
  const router = useRouter();
  const session = useSession();
  const [catalog, setCatalog] = useState(fallbackPlans);
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "failed">("idle");

  useEffect(() => {
    if (!backendEnabled()) return;
    loadPlans().then((rows) => {
      if (rows?.length) setCatalog(rows);
    });
  }, []);

  async function pay(simulateFailure = false) {
    if (!checkout) return;
    setStatus("processing");
    // TODO(phase-3): create a Razorpay subscription server-side, open Razorpay Checkout,
    // verify the signature server-side, and let the webhook update `subscriptions`.
    await new Promise((r) => setTimeout(r, 1200));
    if (simulateFailure) {
      setStatus("failed");
      return;
    }
    if (backendEnabled()) {
      const saved = await saveMockPlan(checkout.id);
      if (!saved.ok) {
        setStatus("failed");
        toast.error(saved.error ?? "Could not activate the plan");
        return;
      }
    }
    updateSession({ plan: checkout.id, planSince: new Date().toISOString() });
    track("payment", { plan: checkout.id, amount: checkout.priceInr });
    router.push(`/plans/success?plan=${checkout.id}`);
  }

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="mb-10 flex items-center justify-between">
        <Wordmark />
        {session?.plan && (
          <span className="rounded-full border border-peach/40 px-3 py-1 text-xs text-peach">
            Current: {catalog.find((p) => p.id === session.plan)?.name}
          </span>
        )}
      </div>

      <div className="mb-12 space-y-4 text-center">
        <Eyebrow className="justify-center">Plans & payment</Eyebrow>
        <h1 className="text-4xl font-medium md:text-6xl">
          Pick your <span className="text-brand">appetite.</span>
        </h1>
        <p className="mx-auto max-w-md text-sm text-soft">
          Prices are placeholders while we are in preview. Cancel anytime. Payments are processed by Razorpay.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {catalog.map((p, i) => {
          const Icon = icons[p.id];
          const current = session?.plan === p.id;
          return (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 40, rotateX: 12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
              className={cn(
                "glass relative flex flex-col rounded-3xl p-7 [transform-style:preserve-3d]",
                p.highlight && "ring-1 ring-peach/60 glow md:-mt-4 md:mb-4",
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-[10px] font-bold tracking-wider text-ink uppercase">
                  Most loved
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/[0.06] text-peach">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-medium">{p.name}</h2>
                  <p className="text-xs text-soft">{p.tagline}</p>
                </div>
              </div>
              <p className="mt-6 font-heading text-5xl tracking-tight">
                {formatInr(p.priceInr)}
                <span className="text-sm text-soft"> /month</span>
              </p>
              <p className="mt-1 text-[10px] tracking-wider text-soft uppercase">Placeholder price</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-peach" aria-hidden /> {perk}
                  </li>
                ))}
              </ul>
              <GradientButton
                className="mt-7 w-full"
                variant={p.highlight ? "brand" : "glass"}
                disabled={current}
                onClick={() => {
                  setStatus("idle");
                  setCheckout(p);
                }}
              >
                {current ? "Your plan" : `Choose ${p.name}`}
              </GradientButton>
            </motion.article>
          );
        })}
      </div>

      <section className="mt-16" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="mb-6 text-2xl font-medium">Compare features</h2>
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th scope="col" className="p-4 font-medium text-soft">Feature</th>
                {catalog.map((p) => (
                  <th key={p.id} scope="col" className={cn("p-4 text-center font-semibold", p.highlight && "text-peach")}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label} className="border-b border-white/5 last:border-0">
                  <th scope="row" className="p-4 text-left font-normal">{row.label}</th>
                  {catalog.map((p) => {
                    const v = row.values[p.id];
                    return (
                      <td key={p.id} className="p-4 text-center">
                        {v === true ? (
                          <Check className="mx-auto size-4 text-peach" aria-label="Included" />
                        ) : v === false ? (
                          <Minus className="mx-auto size-4 text-white/25" aria-label="Not included" />
                        ) : (
                          <span className="text-xs">{v}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!checkout} onOpenChange={(o) => !o && status !== "processing" && setCheckout(null)}>
        <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-7 sm:max-w-md">
          {checkout && (
            <div className="space-y-5">
              <div className="space-y-1">
                <DialogTitle className="text-xl">Checkout — {checkout.name}</DialogTitle>
                <DialogDescription>Mock Razorpay checkout. No real money moves in Phase 1.</DialogDescription>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex justify-between text-sm">
                  <span>{checkout.name} plan · monthly</span>
                  <span className="font-semibold">{formatInr(checkout.priceInr)}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-soft">
                  <span>GST (included, placeholder)</span>
                  <span>—</span>
                </div>
              </div>
              {status === "failed" && (
                <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  Payment failed. Nothing was charged — you can retry.
                </p>
              )}
              <GradientButton className="w-full" size="lg" onClick={() => pay(false)} disabled={status === "processing"}>
                <CreditCard /> {status === "processing" ? "Processing…" : status === "failed" ? "Retry payment" : `Pay ${formatInr(checkout.priceInr)}`}
              </GradientButton>
              <div className="flex items-center justify-between text-xs text-soft">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-peach" aria-hidden /> Secured by Razorpay
                </span>
                <button
                  type="button"
                  className="underline hover:text-cream"
                  onClick={() => {
                    toast.message("Simulating a failed payment");
                    pay(true);
                  }}
                  disabled={status === "processing"}
                >
                  Simulate failure
                </button>
              </div>
              <p className="flex items-center gap-1.5 text-[10px] text-soft">
                <Lock className="size-3" aria-hidden /> Cancel anytime from your profile. Renews monthly.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
