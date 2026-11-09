/** Ported from the original nagrek.com landing (Hostinger Horizons export). */
export const cravings = [
  { id: "pizza", name: "Pizza", note: "A slice of good company.", image: "https://images.hostinger.com/7fd45440-227b-4d20-b90d-4a0347b0ce21.png" },
  { id: "sushi", name: "Sushi", note: "Good rolls. Great conversations.", image: "https://images.hostinger.com/6163b74a-e259-4c15-b4c4-726d84ffc3b2.png" },
  { id: "coffee", name: "Coffee", note: "Something worth waking up for.", image: "https://images.hostinger.com/908c6bc3-bc1a-4b25-93d1-74b770816158.png" },
  { id: "burger", name: "Burger", note: "Meet between bites.", image: "https://images.hostinger.com/f202ad1b-fd54-4da4-bb84-4e41499ce6a2.png" },
] as const;

export type Craving = (typeof cravings)[number];

/** Chips offered during onboarding and on the dashboard. */
export const cuisineChips: string[] = [
  "Pizza", "Sushi", "Coffee", "Burger", "Biryani", "Dosa", "Momos", "Chaat",
  "Ramen", "Tacos", "North Indian", "Chinese", "Thai", "Italian", "Desserts", "Street food",
];

export const cravingEmoji: Record<string, string> = {
  Pizza: "🍕", Sushi: "🍣", Coffee: "☕", Burger: "🍔", Biryani: "🍛", Dosa: "🥞",
  Momos: "🥟", Chaat: "🥗", Ramen: "🍜", Tacos: "🌮", "North Indian": "🍛", Chinese: "🥡",
  Thai: "🍲", Italian: "🍝", Desserts: "🍰", "Street food": "🌯",
};

export const marqueePairs = [
  { food: "Biryani", city: "Hyderabad" },
  { food: "Dosa", city: "Bengaluru" },
  { food: "Vada Pav", city: "Mumbai" },
  { food: "Momos", city: "Delhi" },
  { food: "Coffee", city: "Pune" },
  { food: "Sushi", city: "Gurugram" },
  { food: "Chaat", city: "Lucknow" },
  { food: "Pizza", city: "Chennai" },
  { food: "Kathi Roll", city: "Kolkata" },
  { food: "Ramen", city: "Goa" },
];
