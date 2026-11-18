"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Briefcase, Coffee, LocateFixed, Plus, Shuffle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Wordmark } from "@/components/brand/wordmark";
import { Chip } from "@/components/glass/chip";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cuisineChips, cravingEmoji } from "@/lib/data/cravings";
import { cities, nearestCity } from "@/lib/data/cities";
import { TERMS_VERSION } from "@/lib/data/legal";
import { saveAccount } from "@/lib/account-save";
import { track } from "@/lib/analytics";
import { homeFor } from "@/lib/guards";
import { useDraft } from "@/lib/draft";
import { snapshotOf, updateSession, useSession } from "@/lib/mock/session";
import { whenRouterReady } from "@/lib/nav";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backendEnabled } from "@/lib/supabase/env";
import type { Dietary, GroupSize, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ageFrom, earliestDob, foodStep, interestsStep, latestAdultDob, legalStep, locationStep, MIN_AGE, roundCoord, scheduleStep, tasteStep, toneStep,
} from "@/lib/validation/onboarding";

interface Draft {
  foodInterests: string[];
  tone: Tone | "";
  location: { city: string; area?: string; point?: { lat: number; lng: number } };
  dietary: Dietary | "";
  budget: [number, number];
  groupSize: GroupSize;
  timeSlots: string[];
  languages: string[];
  topics: string[];
  goals: string[];
  dateOfBirth: string;
  adult: boolean;
  respectful: boolean;
}

const emptyDraft: Draft = {
  foodInterests: [],
  tone: "",
  location: { city: "" },
  dietary: "",
  budget: [200, 1000],
  groupSize: "one-on-one",
  timeSlots: [],
  languages: [],
  topics: [],
  goals: [],
  dateOfBirth: "",
  adult: false,
  respectful: false,
};

const TIME_SLOTS = ["Breakfast", "Lunch", "Evening chai", "Dinner", "Late night", "Weekends"];
const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Malayalam", "Gujarati", "Punjabi", "Urdu"];
const TOPICS = ["Startups", "Movies", "Music", "Travel", "Sports", "Books", "Tech", "Art", "Fitness", "Gaming", "Food science", "Careers"];
const GOALS = ["New friends", "Networking", "Food buddies", "Explore my city", "Practice a language", "Just conversation"];
const DIETS: { id: Dietary; label: string }[] = [
  { id: "veg", label: "Vegetarian" },
  { id: "non-veg", label: "Non-veg" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "halal", label: "Halal" },
  { id: "jain", label: "Jain" },
];

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

type StepDef = { id: string; title: string; subtitle: string; schema: z.ZodType };

const steps: StepDef[] = [
  { id: "food", title: "What do you love to eat?", subtitle: "Your cravings are the main thing we match on.", schema: foodStep },
  { id: "tone", title: "How do you like to talk?", subtitle: "If you pick a tone, we only match you with the same tone.", schema: toneStep },
  { id: "location", title: "Where do you eat?", subtitle: "We only ever show your approximate area to others.", schema: locationStep },
  { id: "taste", title: "Your table preferences", subtitle: "Diet, budget and group size help us find a good fit.", schema: tasteStep },
  { id: "schedule", title: "When and in what language?", subtitle: "So matches actually fit your day.", schema: scheduleStep },
  { id: "interests", title: "Beyond the food", subtitle: "Topics to talk about and what you hope to get from Nagrek.", schema: interestsStep },
  { id: "legal", title: "One last thing", subtitle: "Nagrek is for adults who treat each other well.", schema: legalStep },
];

export function OnboardingWizard() {
  const router = useRouter();
  const session = useSession();
  const [index, setIndex, clearStep] = useDraft("onboarding-step", 0);
  const [dir, setDir] = useState(1);
  const [draft, setDraft, clearDraft] = useDraft("onboarding", emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [locating, setLocating] = useState(false);
  const seeded = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  useEffect(() => {
    if (!Number.isInteger(index) || index < 0 || index >= steps.length) setIndex(0);
  }, [index, setIndex]);

  // Already saved: go to the right page instead of asking again.
  useEffect(() => {
    if (!session?.welcomed) return;
    whenRouterReady(() => router.replace(homeFor(snapshotOf(session))));
  }, [session, router]);

  // A half-finished account comes back filled in.
  useEffect(() => {
    if (seeded.current || !session?.preferences) return;
    seeded.current = true;
    const p = session.preferences;
    setDraft({
      foodInterests: p.foodInterests,
      tone: p.tone,
      location: p.location,
      dietary: p.dietary,
      budget: p.budget,
      groupSize: p.groupSize,
      timeSlots: p.timeSlots,
      languages: p.languages,
      topics: p.topics,
      goals: p.goals,
      dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? "",
      adult: !!session.consent?.adult,
      respectful: !!session.consent?.respectful,
    });
  }, [session]);

  const step = steps[index] ?? steps[0];
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function validate(): boolean {
    const result = step.schema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please complete this step");
      return false;
    }
    setError(null);
    return true;
  }

  function next() {
    if (!validate()) return;
    if (index === steps.length - 1) return finish();
    setDir(1);
    setIndex((i) => i + 1);
  }

  function back() {
    setError(null);
    setDir(-1);
    setIndex((i) => Math.max(0, i - 1));
  }

  async function finish() {
    if (backendEnabled()) {
      const supabase = getSupabaseBrowserClient();
      const userId = session?.user?.id;
      if (!supabase || !userId) return toast.error("Not signed in");
      const saved = await saveAccount(supabase, userId, draft);
      if (!saved.ok) return toast.error(saved.error ?? "Could not save your preferences");
    }
    // Preferences also stay in the local session so the rest of the demo keeps working offline.
    updateSession({
      welcomed: true,
      preferences: {
        foodInterests: draft.foodInterests,
        tone: draft.tone as Tone,
        location: draft.location,
        dietary: draft.dietary as Dietary,
        budget: draft.budget,
        groupSize: draft.groupSize,
        timeSlots: draft.timeSlots,
        languages: draft.languages,
        topics: draft.topics,
        goals: draft.goals,
        dateOfBirth: draft.dateOfBirth,
      },
      consent: { adult: true, respectful: true, termsVersion: TERMS_VERSION, acceptedAt: new Date().toISOString() },
    });
    track("onboarding_complete", { foods: draft.foodInterests.length, tone: draft.tone });
    clearDraft();
    clearStep();
    whenRouterReady(() => router.push("/welcome"));
  }

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Location is not available in this browser. Pick your city below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive.current) return;
        const point = { lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) };
        const city = nearestCity(point);
        set({ location: { ...draft.location, city: city.name, point } });
        setLocating(false);
        toast.success(`Located near ${city.name} (rounded to ~1 km)`);
      },
      () => {
        if (!alive.current) return;
        setLocating(false);
        toast.error("Permission denied. No problem — choose your city manually.");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  const progress = ((index + 1) / steps.length) * 100;

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <Wordmark />
        <span className="text-xs text-soft">
          Step {index + 1} of {steps.length}
        </span>
      </div>
      <div
        className="mb-8 h-1.5 overflow-hidden rounded-full bg-white/8"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${progress}%` }} transition={{ ease: "easeOut" }} />
      </div>

      <GlassCard strong className="relative flex-1 overflow-hidden p-6 md:p-9">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h1 className="text-2xl font-medium md:text-3xl">{step.title}</h1>
              <p className="text-sm text-soft">{step.subtitle}</p>
            </div>

            {step.id === "food" && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {[...cuisineChips, ...draft.foodInterests.filter((f) => !(cuisineChips as readonly string[]).includes(f))].map((c) => (
                    <Chip key={c} selected={draft.foodInterests.includes(c)} onClick={() => set({ foodInterests: toggle(draft.foodInterests, c) })}>
                      <span aria-hidden>{cravingEmoji[c] ?? "🍽️"}</span> {c}
                    </Chip>
                  ))}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = custom.trim();
                    if (v && !draft.foodInterests.includes(v)) set({ foodInterests: [...draft.foodInterests, v] });
                    setCustom("");
                  }}
                >
                  <Label htmlFor="custom-food" className="sr-only">Add another food</Label>
                  <Input id="custom-food" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else? e.g. Pav bhaji" className="h-11 rounded-xl" maxLength={30} />
                  <GradientButton type="submit" variant="glass" size="md" aria-label="Add food">
                    <Plus />
                  </GradientButton>
                </form>
              </div>
            )}

            {step.id === "tone" && (
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  { id: "professional", label: "Professional", desc: "Networking, careers, ideas.", icon: Briefcase },
                  { id: "casual", label: "Casual", desc: "Easy-going, fun, light.", icon: Coffee },
                  { id: "random", label: "No preference", desc: "Surprise me — match any tone.", icon: Shuffle },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={draft.tone === t.id}
                    onClick={() => set({ tone: t.id })}
                    className={cn(
                      "rounded-2xl border p-5 text-left transition-all",
                      draft.tone === t.id ? "border-peach/70 bg-peach/10 glow" : "border-white/10 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <t.icon className="mb-3 size-6 text-peach" aria-hidden />
                    <p className="font-semibold">{t.label}</p>
                    <p className="mt-1 text-xs text-soft">{t.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {step.id === "location" && (
              <div className="space-y-5">
                <GradientButton type="button" variant="glass" onClick={detectLocation} disabled={locating}>
                  <LocateFixed /> {locating ? "Locating…" : "Use my current location"}
                </GradientButton>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs text-soft">City</Label>
                    <select
                      id="city"
                      value={draft.location.city}
                      onChange={(e) => {
                        const c = cities.find((x) => x.name === e.target.value);
                        set({ location: { ...draft.location, city: e.target.value, point: c?.point } });
                      }}
                      className="h-11 w-full rounded-xl border border-input bg-white/[0.04] px-3 text-sm"
                    >
                      <option value="" className="bg-ink">Select a city</option>
                      {cities.map((c) => (
                        <option key={c.name} value={c.name} className="bg-ink">{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="area" className="text-xs text-soft">Area (optional)</Label>
                    <Input
                      id="area"
                      value={draft.location.area ?? ""}
                      onChange={(e) => set({ location: { ...draft.location, area: e.target.value } })}
                      placeholder="e.g. Indiranagar"
                      className="h-11 rounded-xl"
                      maxLength={60}
                    />
                  </div>
                </div>
                {draft.location.point && (
                  <p className="text-xs text-soft">
                    Saved as approximately {draft.location.point.lat.toFixed(2)}, {draft.location.point.lng.toFixed(2)} — never your exact spot.
                  </p>
                )}
              </div>
            )}

            {step.id === "taste" && (
              <div className="space-y-7">
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-sm font-semibold">Dietary preference</legend>
                  <div className="flex flex-wrap gap-2">
                    {DIETS.map((d) => (
                      <Chip key={d.id} selected={draft.dietary === d.id} onClick={() => set({ dietary: d.id })}>
                        {d.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold" id="budget-label">Budget per meal</span>
                    <span className="text-peach">₹{draft.budget[0]} – ₹{draft.budget[1]}</span>
                  </div>
                  <Slider
                    aria-labelledby="budget-label"
                    min={0}
                    max={5000}
                    step={50}
                    value={draft.budget}
                    onValueChange={(v) => Array.isArray(v) && set({ budget: [v[0], v[1]] as [number, number] })}
                  />
                </div>
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">Group size</legend>
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={draft.groupSize === "one-on-one"} onClick={() => set({ groupSize: "one-on-one" })}>1-on-1</Chip>
                    <Chip selected={draft.groupSize === "small-group"} onClick={() => set({ groupSize: "small-group" })}>Small group (soon)</Chip>
                  </div>
                </fieldset>
              </div>
            )}

            {step.id === "schedule" && (
              <div className="space-y-6">
                <ChipGroup label="Preferred times" options={TIME_SLOTS} value={draft.timeSlots} onChange={(v) => set({ timeSlots: v })} />
                <ChipGroup label="Languages you speak" options={LANGUAGES} value={draft.languages} onChange={(v) => set({ languages: v })} />
              </div>
            )}

            {step.id === "interests" && (
              <div className="space-y-6">
                <ChipGroup label="Conversation topics" options={TOPICS} value={draft.topics} onChange={(v) => set({ topics: v })} />
                <ChipGroup label="What do you hope to get from Nagrek?" options={GOALS} value={draft.goals} onChange={(v) => set({ goals: v })} />
              </div>
            )}

            {step.id === "legal" && (
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs text-soft">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={draft.dateOfBirth}
                    min={earliestDob()}
                    max={latestAdultDob()}
                    onChange={(e) => set({ dateOfBirth: e.target.value })}
                    aria-describedby="dob-age"
                    className="h-11 max-w-xs rounded-xl [color-scheme:dark]"
                  />
                  {draft.dateOfBirth && <AgeNote dob={draft.dateOfBirth} />}
                </div>
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox checked={draft.adult} onCheckedChange={(c) => set({ adult: c === true })} className="mt-0.5" />
                    <span>I confirm I am <strong>18 years or older</strong>.</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox checked={draft.respectful} onCheckedChange={(c) => set({ respectful: c === true })} className="mt-0.5" />
                    <span>
                      I agree to be respectful and follow the{" "}
                      <Link href="/legal/guidelines" target="_blank" className="text-peach underline">Community Guidelines</Link> and{" "}
                      <Link href="/legal/terms" target="_blank" className="text-peach underline">Terms</Link>.
                    </span>
                  </label>
                </div>
                <p className="flex items-center gap-2 text-xs text-soft">
                  <ShieldCheck className="size-4 text-peach" aria-hidden /> Stored with a timestamp and terms version {TERMS_VERSION}.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </GlassCard>

      <div className="mt-6 flex items-center justify-between gap-3">
        <GradientButton type="button" variant="ghost" onClick={back} disabled={index === 0}>
          <ArrowLeft /> Back
        </GradientButton>
        <GradientButton type="button" onClick={next} size="lg">
          {index === steps.length - 1 ? "Finish" : "Continue"} <ArrowRight />
        </GradientButton>
      </div>
      {session?.user && <p className="mt-4 text-center text-xs text-soft">Signed in as {session.user.email}</p>}
    </main>
  );
}

function AgeNote({ dob }: { dob: string }) {
  const age = ageFrom(dob);
  if (age === -1) {
    return <p id="dob-age" className="text-xs text-red-300">That is not a real date of birth.</p>;
  }
  if (age < MIN_AGE) {
    return (
      <p id="dob-age" role="alert" className="text-xs text-red-300">
        You are {age}. Nagrek is only for people {MIN_AGE} and over, so you can&apos;t continue.
      </p>
    );
  }
  return <p id="dob-age" className="text-xs text-soft">Age {age}. Your date of birth stays private.</p>;
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} selected={value.includes(o)} onClick={() => onChange(toggle(value, o))}>
            {o}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
