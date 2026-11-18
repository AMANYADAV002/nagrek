import type { Dietary } from "@/lib/types";

/** How a candidate relates to what the searcher wants right now. Earlier tiers win, and lower tiers are used only when the earlier ones are empty. */
export type FoodTier = "craving" | "saved" | "category";

export const FOOD_TIER_ORDER: FoodTier[] = ["craving", "saved", "category"];

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Diet is a hard gate, applied before any tier.
 * Jain only matches Jain. Halal only matches halal. Non-veg only matches non-veg.
 * Veg can sit with vegan or eggetarian. Vegan and eggetarian do not sit with each other.
 * Plant-based diets never sit with meat diets.
 */
const PLANT = new Set<Dietary>(["veg", "vegan", "jain", "eggetarian"]);

export function dietCompatible(a: Dietary, b: Dietary): boolean {
  if (a === b) return true;
  if (a === "jain" || b === "jain") return false;
  if (a === "halal" || b === "halal" || a === "non-veg" || b === "non-veg") return false;
  const aPlant = PLANT.has(a);
  const bPlant = PLANT.has(b);
  if (!aPlant || !bPlant) return false;
  return a === "veg" || b === "veg";
}

/** Dishes and the cuisine chips that name a whole category. */
const CATEGORY_DISHES: Record<string, string[]> = {
  "north indian": [
    "paratha", "aloo paratha", "paneer paratha", "gobi paratha", "chole bhature", "chhole bhature",
    "chole", "chhole", "naan", "kulcha", "amritsari kulcha", "butter chicken", "dal makhani",
    "paneer", "paneer tikka", "paneer butter masala", "shahi paneer", "rajma", "rajma chawal",
    "samosa", "kachori", "malai kofta", "kadhi", "aloo gobi", "baingan bharta",
  ],
  "south indian": ["dosa", "masala dosa", "idli", "vada", "medu vada", "uttapam", "sambar", "pongal", "appam", "puttu", "upma", "pesarattu"],
  mughlai: ["biryani", "chicken biryani", "mutton biryani", "veg biryani", "hyderabadi biryani", "kebab", "korma", "nihari", "haleem"],
  "street food": ["chaat", "pani puri", "golgappa", "vada pav", "pav bhaji", "bhel", "dabeli", "kathi roll", "momos", "frankie"],
  chinese: ["noodles", "fried rice", "manchurian", "hakka noodles", "chilli chicken", "spring roll", "dim sum", "chinese"],
  italian: ["pizza", "pasta", "risotto", "lasagna", "italian"],
  japanese: ["sushi", "ramen", "udon"],
  american: ["burger", "fries", "hot dog", "american"],
  western: ["pizza", "pasta", "burger", "fries", "hot dog", "sandwich", "western"],
  "fast food": ["burger", "pizza", "fries", "hot dog", "fast food"],
  cafe: ["coffee", "chai", "tea"],
  thai: ["pad thai", "thai", "green curry"],
  mexican: ["tacos", "burrito", "nachos"],
  desserts: ["dessert", "desserts", "cake", "ice cream", "gulab jamun", "jalebi", "rasmalai", "brownie"],
};

const dishCategories = new Map<string, string[]>();
for (const [category, dishes] of Object.entries(CATEGORY_DISHES)) {
  const add = (name: string) => {
    const key = norm(name);
    const list = dishCategories.get(key) ?? [];
    if (!list.includes(category)) list.push(category);
    dishCategories.set(key, list);
  };
  add(category);
  for (const dish of dishes) add(dish);
}

/** Longest known dishes first, so "paneer paratha" hits paratha rather than a shorter word. */
const knownDishes = [...dishCategories.keys()].sort((a, b) => b.length - a.length);

export function categoriesOf(food: string): string[] {
  const key = norm(food);
  if (!key) return [];
  const direct = dishCategories.get(key);
  if (direct) return direct;
  for (const dish of knownDishes) {
    if (dish.length < 4) continue;
    if (key.includes(dish)) return dishCategories.get(dish) ?? [];
  }
  return [];
}

export function sameFood(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

export function sameCategory(a: string, b: string): boolean {
  if (sameFood(a, b)) return true;
  const left = categoriesOf(a);
  const right = new Set(categoriesOf(b));
  return left.some((c) => right.has(c));
}

/**
 * Best food relation between what I want now and another person.
 * `craving` — they are asking for the same dish right now.
 * `saved` — the dish is on a profile food list.
 * `category` — different dishes in the same cuisine (paratha and chole bhature are both North Indian).
 */
export function foodLevel(myCraving: string, mySaved: string[], theirCurrent: string | null, theirSaved: string[]): FoodTier | null {
  const current = theirCurrent?.trim() ?? "";
  if (current && sameFood(myCraving, current)) return "craving";
  const onTheirList = theirSaved.some((f) => sameFood(f, myCraving));
  const onMyList = current ? mySaved.some((f) => sameFood(f, current)) : false;
  if (onTheirList || onMyList) return "saved";
  const theirs = [...(current ? [current] : []), ...theirSaved];
  if (theirs.some((f) => sameCategory(myCraving, f))) return "category";
  return null;
}

/** Keep only the best tier that has anyone in it. */
export function bestTier<T extends { tier: FoodTier }>(rows: T[]): T[] {
  for (const tier of FOOD_TIER_ORDER) {
    const group = rows.filter((r) => r.tier === tier);
    if (group.length) return group;
  }
  return [];
}
