import type { Metadata } from "next";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientLink } from "@/components/glass/gradient-button";

export const metadata: Metadata = { title: "Simulated DigiLocker consent" };

export default async function MockConsentPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const safeState = typeof state === "string" && /^[a-f0-9]{32}$/.test(state) ? state : "";
  return (
    <GlassCard className="mx-auto max-w-lg p-6 md:p-8">
      <p className="text-xs uppercase tracking-wide text-peach">Demo mode</p>
      <h1 className="mt-3 text-3xl font-medium">Simulated DigiLocker consent</h1>
      <p className="mt-2 text-sm text-soft">
        This is not the government DigiLocker site. Allowing access creates a simulated locker with sample files that are not government documents.
      </p>
      {safeState ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <GradientLink href={`/api/digilocker/callback?code=mock-auth-code&state=${safeState}`}>Allow simulated access</GradientLink>
          <GradientLink href={`/api/digilocker/callback?error=access_denied&state=${safeState}`} variant="outline">Deny</GradientLink>
        </div>
      ) : (
        <p className="mt-6 text-sm">Start again from the DigiLocker page.</p>
      )}
    </GlassCard>
  );
}
