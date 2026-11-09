import { z } from "zod";

export const MIN_AGE = 18;
export const MAX_AGE = 110;

/**
 * Whole years between `dob` (YYYY-MM-DD) and `now`, or -1 for anything that is not a real
 * past calendar date (31 Feb, 2008-13-01, future dates). A birthday counts on the day itself;
 * 29 Feb birthdays turn a year older on 1 Mar in non-leap years.
 */
export function ageFrom(dob: string, now: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return -1;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(y, mo - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return -1;

  const ny = now.getFullYear();
  const nm = now.getMonth() + 1;
  const nd = now.getDate();
  if (y > ny || (y === ny && (mo > nm || (mo === nm && d > nd)))) return -1;

  let age = ny - y;
  if (nm < mo || (nm === mo && nd < d)) age -= 1;
  return age;
}

/** Latest date of birth (YYYY-MM-DD) that is MIN_AGE today, for the date picker's max. */
export function latestAdultDob(now: Date = new Date()): string {
  const d = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  if (d.getMonth() !== now.getMonth()) d.setDate(0);
  return isoDate(d);
}

export function earliestDob(now: Date = new Date()): string {
  return isoDate(new Date(now.getFullYear() - MAX_AGE, now.getMonth(), now.getDate()));
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    .refine((d) => ageFrom(d) !== -1, "Enter a real date of birth")
    .refine((d) => ageFrom(d) === -1 || ageFrom(d) >= MIN_AGE, "Nagrek is only for people 18 and over")
    .refine((d) => ageFrom(d) <= MAX_AGE, "Enter a real date of birth"),
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
