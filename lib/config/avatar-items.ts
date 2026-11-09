import type { AvatarConfig } from "@/lib/types";

export type AvatarCategory = keyof AvatarConfig;

export interface AvatarItem {
  id: string;
  category: AvatarCategory;
  label: string;
  /** Free items have price 0. Paid items are one-time ₹ purchases (Razorpay, TODO(phase-3)). */
  priceInr: number;
  /** Optional non-money unlock: a streak milestone or the Ultra plan. */
  unlock?: { type: "streak"; days: number } | { type: "plan"; plan: "ultra" };
}

export const avatarCategories: { id: AvatarCategory; label: string }[] = [
  { id: "skin", label: "Face" },
  { id: "hair", label: "Hair" },
  { id: "hairColor", label: "Hair colour" },
  { id: "outfit", label: "Outfit" },
  { id: "accessory", label: "Accessories" },
  { id: "background", label: "Background" },
];

export const skinTones: Record<string, string> = {
  s1: "#f5d0b5", s2: "#e8b48f", s3: "#c98d63", s4: "#9c6644", s5: "#6b4430",
};
export const hairColors: Record<string, string> = {
  black: "#1c1a1a", brown: "#5a3825", blonde: "#d9b26f", pink: "#ff8fb1", peach: "#ff936f", blue: "#6aa8ff",
};
export const outfitColors: Record<string, string> = {
  tee: "#ff7e5f", hoodie: "#3b3f4c", kurta: "#feb47b", jacket: "#1f2937", chef: "#f6f3ef", neon: "#a78bfa",
};
export const backgrounds: Record<string, [string, string]> = {
  peach: ["#ff7e5f", "#feb47b"],
  night: ["#1e1b4b", "#0b0c0f"],
  mint: ["#34d399", "#065f46"],
  sunset: ["#f472b6", "#fb923c"],
  galaxy: ["#7c3aed", "#0ea5e9"],
};

export const avatarItems: AvatarItem[] = [
  ...Object.keys(skinTones).map((id) => ({ id, category: "skin" as const, label: `Tone ${id.slice(1)}`, priceInr: 0 })),
  { id: "short", category: "hair", label: "Short", priceInr: 0 },
  { id: "long", category: "hair", label: "Long", priceInr: 0 },
  { id: "bun", category: "hair", label: "Bun", priceInr: 0 },
  { id: "curly", category: "hair", label: "Curly", priceInr: 49 },
  { id: "mohawk", category: "hair", label: "Mohawk", priceInr: 79 },
  { id: "none", category: "hair", label: "Bald", priceInr: 0 },
  { id: "black", category: "hairColor", label: "Black", priceInr: 0 },
  { id: "brown", category: "hairColor", label: "Brown", priceInr: 0 },
  { id: "blonde", category: "hairColor", label: "Blonde", priceInr: 0 },
  { id: "pink", category: "hairColor", label: "Pink", priceInr: 29 },
  { id: "peach", category: "hairColor", label: "Nagrek peach", priceInr: 0, unlock: { type: "streak", days: 7 } },
  { id: "blue", category: "hairColor", label: "Electric blue", priceInr: 29 },
  { id: "tee", category: "outfit", label: "Tee", priceInr: 0 },
  { id: "hoodie", category: "outfit", label: "Hoodie", priceInr: 0 },
  { id: "kurta", category: "outfit", label: "Kurta", priceInr: 59 },
  { id: "jacket", category: "outfit", label: "Jacket", priceInr: 99 },
  { id: "chef", category: "outfit", label: "Chef coat", priceInr: 0, unlock: { type: "streak", days: 15 } },
  { id: "neon", category: "outfit", label: "Neon fit", priceInr: 0, unlock: { type: "plan", plan: "ultra" } },
  { id: "none", category: "accessory", label: "None", priceInr: 0 },
  { id: "glasses", category: "accessory", label: "Glasses", priceInr: 0 },
  { id: "shades", category: "accessory", label: "Shades", priceInr: 39 },
  { id: "cap", category: "accessory", label: "Cap", priceInr: 49 },
  { id: "headphones", category: "accessory", label: "Headphones", priceInr: 69 },
  { id: "crown", category: "accessory", label: "Crown", priceInr: 0, unlock: { type: "streak", days: 30 } },
  { id: "peach", category: "background", label: "Peach", priceInr: 0 },
  { id: "night", category: "background", label: "Night", priceInr: 0 },
  { id: "mint", category: "background", label: "Mint", priceInr: 19 },
  { id: "sunset", category: "background", label: "Sunset", priceInr: 19 },
  { id: "galaxy", category: "background", label: "Galaxy", priceInr: 0, unlock: { type: "plan", plan: "ultra" } },
];

export const defaultAvatar: AvatarConfig = {
  skin: "s2",
  hair: "short",
  hairColor: "black",
  outfit: "tee",
  accessory: "none",
  background: "peach",
};

export function itemKey(item: Pick<AvatarItem, "category" | "id">) {
  return `${item.category}:${item.id}`;
}
