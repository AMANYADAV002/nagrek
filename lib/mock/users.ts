import type { MockUser } from "@/lib/types";

/** Phase 1 mock people. TODO(phase-2): replace with `profiles` + `user_preferences`. */
export const mockUsers: MockUser[] = [
  {
    id: "u-aisha", name: "Aisha Khan", handle: "aisha.eats", bio: "Biryani purist. Will debate Hyderabadi vs Lucknowi forever.",
    city: "Bengaluru", area: "Indiranagar", point: { lat: 12.97, lng: 77.64 }, foodInterests: ["Biryani", "Coffee", "Desserts"],
    tone: "casual", dietary: "halal", budget: [300, 800], languages: ["English", "Hindi", "Urdu"], trustScore: 4.8, streak: 12, plan: "premium",
    avatar: { skin: "s3", hair: "long", hairColor: "black", outfit: "kurta", accessory: "glasses", background: "sunset" },
    followers: 412, following: 188, connections: 37,
  },
  {
    id: "u-rohan", name: "Rohan Mehta", handle: "rohanbites", bio: "Product designer by day, ramen hunter by night.",
    city: "Bengaluru", area: "Koramangala", point: { lat: 12.93, lng: 77.62 }, foodInterests: ["Ramen", "Sushi", "Coffee"],
    tone: "professional", dietary: "non-veg", budget: [500, 1500], languages: ["English", "Hindi"], trustScore: 4.6, streak: 5, plan: "ultra",
    avatar: { skin: "s2", hair: "short", hairColor: "brown", outfit: "jacket", accessory: "headphones", background: "night" },
    followers: 230, following: 301, connections: 22,
  },
  {
    id: "u-meera", name: "Meera Iyer", handle: "dosa.diaries", bio: "Filter coffee and crispy dosa, every Sunday.",
    city: "Bengaluru", area: "Jayanagar", point: { lat: 12.93, lng: 77.58 }, foodInterests: ["Dosa", "Coffee", "Street food"],
    tone: "casual", dietary: "veg", budget: [150, 500], languages: ["English", "Tamil", "Kannada"], trustScore: 4.9, streak: 21, plan: "plus",
    avatar: { skin: "s4", hair: "bun", hairColor: "black", outfit: "tee", accessory: "none", background: "peach" },
    followers: 980, following: 120, connections: 64,
  },
  {
    id: "u-kabir", name: "Kabir Singh", handle: "kabir.momo", bio: "Momo crawl organiser. Spicy chutney or nothing.",
    city: "Delhi", area: "Hauz Khas", point: { lat: 28.55, lng: 77.2 }, foodInterests: ["Momos", "Chinese", "Street food"],
    tone: "random", dietary: "non-veg", budget: [100, 400], languages: ["Hindi", "English", "Punjabi"], trustScore: 4.4, streak: 3, plan: "plus",
    avatar: { skin: "s3", hair: "mohawk", hairColor: "black", outfit: "hoodie", accessory: "cap", background: "mint" },
    followers: 145, following: 160, connections: 18,
  },
  {
    id: "u-zara", name: "Zara D'Souza", handle: "zara.slice", bio: "Neapolitan pizza nerd. Ask me about dough hydration.",
    city: "Mumbai", area: "Bandra", point: { lat: 19.06, lng: 72.84 }, foodInterests: ["Pizza", "Italian", "Desserts"],
    tone: "casual", dietary: "eggetarian", budget: [400, 1200], languages: ["English", "Hindi", "Konkani"], trustScore: 4.7, streak: 9, plan: "premium",
    avatar: { skin: "s1", hair: "curly", hairColor: "pink", outfit: "tee", accessory: "shades", background: "galaxy" },
    followers: 655, following: 402, connections: 41,
  },
  {
    id: "u-arjun", name: "Arjun Rao", handle: "arjun.thali", bio: "Startup founder. Lunch meetings are my love language.",
    city: "Bengaluru", area: "HSR Layout", point: { lat: 12.91, lng: 77.64 }, foodInterests: ["North Indian", "Biryani", "Thai"],
    tone: "professional", dietary: "non-veg", budget: [600, 2000], languages: ["English", "Telugu", "Hindi"], trustScore: 4.5, streak: 15, plan: "ultra",
    avatar: { skin: "s4", hair: "short", hairColor: "black", outfit: "jacket", accessory: "glasses", background: "night" },
    followers: 310, following: 95, connections: 52,
  },
];

export function getMockUser(id: string): MockUser | undefined {
  return mockUsers.find((u) => u.id === id);
}
