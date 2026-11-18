"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";
import { isAdultDob } from "@/lib/security/kyc";
import { setuRedirectAllowed } from "@/lib/kyc/age";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "none" | "pending" | "verified" | "rejected";

const STATUS_COPY: Record<Status, string> = {
  none: "Verify once to start matching.",
  pending: "Waiting for DigiLocker. This page updates on its own.",
  verified: "Verified. Opening matching.",
  rejected: "This check did not pass. Nagrek is for people 18 and over.",
};

export function VerifyKycView() {
  const router = useRouter();
  const params = useSearchParams();
  const [dob, setDob] = useState("");
  const [status, setStatus] = useState<Status>("none");
  const [busy, setBusy] = useState(false);
  const callbackStarted = useRef(false);
  const dev = process.env.NODE_ENV !== "production";
  const success = params.get("success");
  const requestId = params.get("id");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    const pull = () => {
      fetch("/api/kyc/status")
        .then(async (res) => {
          if (!res.ok || cancelled) return;
          const json = (await res.json()) as { status?: string; userId?: string };
          if (json.status === "pending" || json.status === "verified" || json.status === "rejected" || json.status === "none") {
            setStatus(json.status);
          }
          if (json.status === "verified") router.push("/dashboard");
          if (!supabase || !json.userId || channel) return;
          channel = supabase
            .channel(`kyc-status:${json.userId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "kyc_status", filter: `user_id=eq.${json.userId}` }, () => pull())
            .subscribe();
        })
        .catch(() => {});
    };

    pull();
    const poll = setInterval(pull, 4_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (callbackStarted.current || success !== "True" || !requestId) return;
    callbackStarted.current = true;
    fetch("/api/kyc/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    })
      .then(async (res) => {
        const json = (await res.json()) as { status?: string; error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Verification is still pending.");
          return;
        }
        if (json.status === "verified" || json.status === "rejected") setStatus(json.status);
        if (json.status === "verified") router.push("/dashboard");
      })
      .catch(() => toast.error("Verification is still pending."));
  }, [requestId, router, success]);

  async function start(path: "/api/kyc/initiate" | "/api/kyc/sandbox-complete") {
    if (path === "/api/kyc/initiate" && !isAdultDob(dob)) {
      toast.error("Nagrek is only for people 18 and over.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: path === "/api/kyc/initiate" ? JSON.stringify({ dateOfBirth: dob }) : "{}",
      });
      const json = (await res.json()) as { error?: string; redirectUrl?: string; mode?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Verification could not be started.");
        return;
      }
      if (typeof json.redirectUrl === "string" && setuRedirectAllowed(json.redirectUrl)) {
        window.location.assign(json.redirectUrl);
        return;
      }
      setStatus(path === "/api/kyc/sandbox-complete" ? "verified" : "pending");
      if (path === "/api/kyc/sandbox-complete") router.push("/dashboard");
    } catch {
      toast.error("Verification could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="mx-auto max-w-lg p-6 md:p-8">
      <Eyebrow>Identity</Eyebrow>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-medium">
        <ShieldCheck className="size-7 text-peach" aria-hidden /> Verify your identity
      </h1>
      <p className="mt-2 text-sm text-soft">
        DigiLocker checks that you are 18 or older. Nagrek stores the result, not your identity document.
      </p>
      <p className="mt-4 text-sm" role="status">{STATUS_COPY[status]}</p>
      <label className="mt-6 block text-sm" htmlFor="kyc-dob">
        Date of birth
        <input
          id="kyc-dob"
          type="date"
          value={dob}
          onChange={(event) => setDob(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-cream"
          required
        />
      </label>
      <GradientButton className="mt-6 w-full" size="lg" disabled={busy || status === "verified"} onClick={() => void start("/api/kyc/initiate")}>
        Verify Identity with DigiLocker
      </GradientButton>
      {dev && (
        <GradientButton className="mt-3 w-full" variant="outline" size="md" disabled={busy} onClick={() => void start("/api/kyc/sandbox-complete")}>
          Simulate DigiLocker Verification
        </GradientButton>
      )}
    </GlassCard>
  );
}
