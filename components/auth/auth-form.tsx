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
import { loadMyAccount } from "@/lib/actions/account";
import { homeFor } from "@/lib/guards";
import { hydrateSession, snapshotOf, updateSession, useSession } from "@/lib/mock/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";
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
    updateSession({
      user: { id: "me", name, email, handle: email.split("@")[0].replace(/[^a-z0-9._]/gi, "").toLowerCase() || "you" },
    });
    if (isSignUp) track("signup", { method: "password" });
    const next = session ? { ...snapshotOf(session), signedIn: true } : { signedIn: true, onboarded: false, plan: null };
    router.push(homeFor(next));
  }

  async function enterWithAccount() {
    const loaded = await loadMyAccount();
    if (loaded.error) return toast.error(loaded.error);
    if (loaded.account) hydrateSession(loaded.account);
    const snap = loaded.account ? snapshotOf(loaded.account) : { signedIn: true, onboarded: false, plan: null };
    router.refresh();
    router.push(homeFor(snap));
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
    const email = parsed.data.email;

    if (backendEnabled()) {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setPending(false);
        return toast.error("Supabase is not configured.");
      }
      if (isSignUp) {
        const name = "name" in parsed.data ? parsed.data.name : email.split("@")[0];
        const { data: created, error } = await supabase.auth.signUp({
          email,
          password: parsed.data.password,
          options: { data: { name }, emailRedirectTo: `${location.origin}/auth/callback` },
        });
        setPending(false);
        if (error) return toast.error(error.message);
        track("signup", { method: "password" });
        if (!created.session) return toast.success("Check your email to confirm your account, then sign in.");
        return enterWithAccount();
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
      setPending(false);
      if (error) return toast.error(error.message);
      return enterWithAccount();
    }

    await new Promise((r) => setTimeout(r, 500));
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
            onClick={async () => {
              if (!backendEnabled()) {
                toast.info("Google sign-in connects once Supabase is configured — using a demo account.");
                finish(session?.user?.name ?? "Demo Foodie", "demo@nagrek.com");
                return;
              }
              const { error } = await getSupabaseBrowserClient()!.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${location.origin}/auth/callback` },
              });
              if (error) toast.error(error.message);
            }}
          >
            <GoogleIcon /> Continue with Google
          </GradientButton>
          <GradientButton
            type="button"
            variant="glass"
            onClick={async () => {
              const email = (document.getElementById("email") as HTMLInputElement | null)?.value ?? "";
              const parsed = z.object({ email: z.email("Enter your email above first") }).safeParse({ email });
              if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Enter your email above first");
              if (!backendEnabled()) return toast.success("Magic link sent! (Demo only — add Supabase keys to send a real one.)");
              const { error } = await getSupabaseBrowserClient()!.auth.signInWithOtp({
                email: parsed.data.email,
                options: { emailRedirectTo: `${location.origin}/auth/callback` },
              });
              if (error) return toast.error(error.message);
              toast.success("Magic link sent. Check your inbox.");
            }}
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
