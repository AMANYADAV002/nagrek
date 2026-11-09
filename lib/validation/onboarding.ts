import { z } from "zod";

export const MIN_AGE = 18;

/** Whole years between `dob` (YYYY-MM-DD) and `now`. */
export function ageFrom(dob: string, now: Date = new Date()): number {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return -1;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/** Rounds to 2 decimals (~1.1 km) so exact positions are never stored. */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export const foodStep = z.object({
  foodInterests: z.array(z.string().trim().min(1)).min(1, "Pick at least one craving").max(10, "Up to 10 please"),
});

export const toneStep = z.object({
  tone: z.enum(["professional", "casual", "random"], { error: "Choose a conversation tone" }),
});

export const locationStep = z.object({
  location: z.object({
    city: z.string().trim().min(2, "Tell us your city"),
    area: z.string().trim().max(60).optional(),
    point: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  }),
});

export const tasteStep = z.object({
  dietary: z.enum(["veg", "non-veg", "vegan", "eggetarian", "halal", "jain"], { error: "Choose a dietary preference" }),
  budget: z.tuple([z.number().min(0), z.number().max(10000)]).refine(([a, b]) => a < b, "Invalid budget range"),
  groupSize: z.enum(["one-on-one", "small-group"]),
});

export const scheduleStep = z.object({
  timeSlots: z.array(z.string()).min(1, "Pick at least one time"),
  languages: z.array(z.string()).min(1, "Pick at least one language"),
});

export const interestsStep = z.object({
  topics: z.array(z.string()).min(1, "Pick at least one topic"),
  goals: z.array(z.string()).min(1, "Tell us what you hope to get"),
});

export const legalStep = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
    .refine((d) => ageFrom(d) >= MIN_AGE, "Nagrek is only for people 18 and over")
    .refine((d) => ageFrom(d) <= 110, "Enter a real date of birth"),
  adult: z.literal(true, { error: "You must confirm you are 18+" }),
  respectful: z.literal(true, { error: "You must agree to be respectful" }),
});

export const onboardingSchema = z.object({
  ...foodStep.shape,
  ...toneStep.shape,
  ...locationStep.shape,
  ...tasteStep.shape,
  ...scheduleStep.shape,
  ...interestsStep.shape,
  ...legalStep.shape,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
