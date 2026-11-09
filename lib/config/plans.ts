import type { PlanId } from "@/lib/types";

/**
 * PLACEHOLDER PRICES — not final. Edit here for the demo, or in the `plans`
 * table (supabase/seed.sql) once Supabase is configured. The plans page
 * reads the table when it is available.
 */
export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceInr: number;
  period: "month";
  rank: number;
  highlight?: boolean;
  dailyMatches: number | "unlimited";
  music: boolean;
  priorityMatching: boolean;
  rewardTier: 1 | 2 | 3;
  perks: string[];
}

export const plans: Plan[] = [
  {
    id: "plus",
    name: "Plus",
    tagline: "Start sharing tables",
    priceInr: 199,
    period: "month",
    rank: 1,
    dailyMatches: 5,
    music: false,
    priorityMatching: false,
    rewardTier: 1,
    perks: ["Core food + tone matching", "Profile and basic avatar", "Post and view stories", "Starter streak rewards"],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "For regular foodies",
    priceInr: 499,
    period: "month",
    rank: 2,
    highlight: true,
    dailyMatches: 20,
    music: true,
    priorityMatching: false,
    rewardTier: 2,
    perks: ["Everything in Plus", "Premium music library in calls", "20 matches a day", "Extended streak rewards"],
  },
  {
    id: "ultra",
    name: "Ultra",
    tagline: "The whole menu",
    priceInr: 999,
    period: "month",
    rank: 3,
    dailyMatches: "unlimited",
    music: true,
    priorityMatching: true,
    rewardTier: 3,
    perks: ["Everything in Premium", "Priority matching", "Exclusive avatar items", "Hotel-tier sponsor rewards", "Streak freeze (coming soon)"],
  },
];

export const comparisonRows: { label: string; values: Record<PlanId, string | boolean> }[] = [
  { label: "Food + tone matching", values: { plus: true, premium: true, ultra: true } },
  { label: "Daily matches", values: { plus: "5", premium: "20", ultra: "Unlimited" } },
  { label: "Stories", values: { plus: true, premium: true, ultra: true } },
  { label: "Premium music in calls", values: { plus: false, premium: true, ultra: true } },
  { label: "Priority matching", values: { plus: false, premium: false, ultra: true } },
  { label: "Streak rewards", values: { plus: "Cafes", premium: "Cafes + restaurants", ultra: "Cafes, restaurants + hotels" } },
  { label: "Exclusive avatar items", values: { plus: false, premium: false, ultra: true } },
  { label: "Streak freeze", values: { plus: false, premium: false, ultra: "Soon" } },
];

export function getPlan(id: PlanId | null | undefined): Plan | undefined {
  return plans.find((p) => p.id === id);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
