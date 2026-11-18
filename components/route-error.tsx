"use client";

import { RotateCcw } from "lucide-react";
import { GradientButton } from "@/components/glass/gradient-button";
import { GlassCard } from "@/components/glass/glass-card";

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <GlassCard className="max-w-md space-y-4 p-8 text-center">
        <p className="font-hand text-2xl text-peach">Something got burnt.</p>
        <h1 className="text-2xl font-medium">We could not load this page</h1>
        <p className="text-sm text-soft">{error.digest ? `Reference: ${error.digest}` : "Please try again."}</p>
        <GradientButton onClick={reset}>
          <RotateCcw /> Try again
        </GradientButton>
      </GlassCard>
    </div>
  );
}
