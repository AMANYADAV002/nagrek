import type { PlanId } from "@/lib/types";

export interface Sponsor {
  id: string;
  name: string;
  kind: "cafe" | "restaurant" | "hotel";
  city: string;
}

export interface Reward {
  id: string;
  sponsorId: string;
  title: string;
  description: string;
  /** Verified in-person visits needed (the visit streak). */
  minVisits: number;
  minPlan: PlanId;
  expiresAt: string;
  stock: number;
}

/** Phase 1 mock sponsors/rewards. Coupon codes are never in the client — TODO(phase-6) server-side issuance. */
export const sponsors: Sponsor[] = [
  { id: "sp-brewhouse", name: "Third Wave Brewhouse", kind: "cafe", city: "Bengaluru" },
  { id: "sp-spice", name: "Spice Route Kitchen", kind: "restaurant", city: "Bengaluru" },
  { id: "sp-tajview", name: "The Grand Terrace Hotel", kind: "hotel", city: "Mumbai" },
  { id: "sp-momo", name: "Momo Republic", kind: "restaurant", city: "Delhi" },
];

export const rewards: Reward[] = [
  { id: "r1", sponsorId: "sp-brewhouse", title: "Free cappuccino", description: "One free regular cappuccino with any food order.", minVisits: 1, minPlan: "plus", expiresAt: "2026-12-31", stock: 120 },
  { id: "r2", sponsorId: "sp-momo", title: "20% off momo platter", description: "Valid on dine-in for two.", minVisits: 3, minPlan: "plus", expiresAt: "2026-12-31", stock: 60 },
  { id: "r3", sponsorId: "sp-spice", title: "₹500 off dinner for two", description: "Minimum bill ₹1,500.", minVisits: 5, minPlan: "premium", expiresAt: "2026-12-31", stock: 25 },
  { id: "r4", sponsorId: "sp-tajview", title: "Weekend brunch for two", description: "Complimentary brunch at the rooftop terrace.", minVisits: 10, minPlan: "ultra", expiresAt: "2026-12-31", stock: 5 },
];

export function sponsorFor(id: string) {
  return sponsors.find((s) => s.id === id);
}
