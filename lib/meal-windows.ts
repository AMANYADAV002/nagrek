/** Fixed meal windows in IST to concentrate queue density. */

export type MealWindow = {
  id: 'lunch' | 'dinner'
  label: string
  startMinutes: number // minutes from midnight IST
  endMinutes: number
}

export const MEAL_WINDOWS: MealWindow[] = [
  { id: 'lunch', label: 'Lunch', startMinutes: 12 * 60, endMinutes: 14 * 60 },
  { id: 'dinner', label: 'Dinner', startMinutes: 19 * 60, endMinutes: 21 * 60 },
]

function istMinutesNow(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  return hour * 60 + minute
}

export function currentMealWindow(date = new Date()): MealWindow | null {
  const m = istMinutesNow(date)
  return MEAL_WINDOWS.find((w) => m >= w.startMinutes && m < w.endMinutes) ?? null
}

export function nextMealWindow(date = new Date()): { window: MealWindow; minutesUntil: number } {
  const m = istMinutesNow(date)
  for (const w of MEAL_WINDOWS) {
    if (m < w.startMinutes) {
      return { window: w, minutesUntil: w.startMinutes - m }
    }
  }
  // After dinner → next day's lunch
  const lunch = MEAL_WINDOWS[0]
  return { window: lunch, minutesUntil: 24 * 60 - m + lunch.startMinutes }
}

export function formatMinutesUntil(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}
