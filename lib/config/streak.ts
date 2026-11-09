/** Streak milestones (days in the current month). Edit freely. */
export const STREAK_MILESTONES = [3, 7, 15, 30] as const;

export const streakLevels = [
  { min: 0, name: "Appetizer" },
  { min: 3, name: "Snacker" },
  { min: 7, name: "Regular" },
  { min: 15, name: "Foodie" },
  { min: 30, name: "Legend" },
] as const;

export function levelFor(streak: number) {
  return [...streakLevels].reverse().find((l) => streak >= l.min) ?? streakLevels[0];
}
