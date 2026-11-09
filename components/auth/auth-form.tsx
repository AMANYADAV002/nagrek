"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeFor } from "@/lib/guards";
import { snapshotOf, updateSession, useSession } from "@/lib/mock/session";
import { track } from "@/lib/analytics";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name (2+ characters)").max(40),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});
const signInSchema = signUpSchema.pick({ email: true, password: true });

type Errors = Partial<Record<"name" | "email" | "password", string>>;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const session = useSession();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  function finish(name: string, email: string) {
    // TODO(phase-2): supabase.auth.signUp / signInWithPassword.
    updateSession({
      user: { id: "me", name, email, handle: email.split("@")[0].replace(/[^a-z0-9._]/gi, "").toLowerCase() || "you" },
    });
    if (isSignUp) track("signup", { method: "password" });
    const next = session ? { ...snapshotOf(session), signedIn: true } : { signedIn: true, onboarded: false, plan: null };
    router.push(homeFor(next));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse(data);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    await new Promise((r) => setTimeout(r, 500));
    const email = parsed.data.email;
    const name = "name" in parsed.data ? (parsed.data.name as string) : session?.user?.name ?? email.split("@")[0];
    finish(name, email);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <GlassCard strong className="space-y-6 p-7 md:p-9">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">{isSignUp ? "Pull up a chair" : "Welcome back"}</h1>
          <p className="text-sm text-soft">
            {isSignUp ? "Create your account to start matching over food." : "Sign in to see who is hungry nearby."}
          </p>
        </div>

        <div className="grid gap-2.5">
          <GradientButton
            type="button"
            variant="glass"
            onClick={() => {
              // TODO(phase-2): supabase.auth.signInWithOAuth({ provider: "google" })
              toast.info("Google sign-in connects in Phase 2 — using a demo account.");
              finish(session?.user?.name ?? "Demo Foodie", "demo@nagrek.com");
            }}
          >
            <GoogleIcon /> Continue with Google
          </GradientButton>
          <GradientButton
            type="button"
            variant="glass"
            onClick={() => toast.success("Magic link sent! (Mocked — TODO(phase-2) supabase.auth.signInWithOtp)")}
          >
            <Mail /> Email me a magic link
          </GradientButton>
        </div>

        <div className="flex items-center gap-3 text-[10px] tracking-widest text-soft uppercase">
          <span className="h-px flex-1 bg-white/10" /> or with password <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {isSignUp && (
            <Field id="name" label="Display name" error={errors.name}>
              <Input id="name" name="name" autoComplete="name" placeholder="Priya" aria-invalid={!!errors.name} className="h-11 rounded-xl" />
            </Field>
          )}
          <Field id="email" label="Email" error={errors.email}>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} className="h-11 rounded-xl" />
          </Field>
          <Field id="password" label="Password" error={errors.password}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
              aria-invalid={!!errors.password}
              className="h-11 rounded-xl"
            />
          </Field>
          <GradientButton type="submit" className="w-full" disabled={pending}>
            <Sparkles /> {pending ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
          </GradientButton>
        </form>

        <p className="text-center text-xs text-soft">
          {isSignUp ? "Already have an account? " : "New to Nagrek? "}
          <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="text-peach hover:underline">
            {isSignUp ? "Sign in" : "Create one"}
          </Link>
        </p>
      </GlassCard>
    </motion.div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-soft">
        {label}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
