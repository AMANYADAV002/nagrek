/** Curated seed for Explore. TODO(phase-6): `places` table; Google Places later. */
export interface Place {
  id: string;
  name: string;
  cuisine: string;
  city: string;
  area: string;
  priceLevel: 1 | 2 | 3;
  rating: number;
  sponsored?: boolean;
  rewardHint?: string;
}

export const places: Place[] = [
  { id: "p1", name: "Third Wave Brewhouse", cuisine: "Coffee", city: "Bengaluru", area: "Indiranagar", priceLevel: 2, rating: 4.6, sponsored: true, rewardHint: "Free cappuccino at 3-day streak" },
  { id: "p2", name: "Spice Route Kitchen", cuisine: "North Indian", city: "Bengaluru", area: "Koramangala", priceLevel: 3, rating: 4.5, sponsored: true, rewardHint: "₹500 off at 15-day streak" },
  { id: "p3", name: "Vidyarthi Bhavan", cuisine: "Dosa", city: "Bengaluru", area: "Basavanagudi", priceLevel: 1, rating: 4.8 },
  { id: "p4", name: "Meghana Foods", cuisine: "Biryani", city: "Bengaluru", area: "Jayanagar", priceLevel: 2, rating: 4.4 },
  { id: "p5", name: "Ramen Bar Ichi", cuisine: "Ramen", city: "Bengaluru", area: "HSR Layout", priceLevel: 2, rating: 4.3 },
  { id: "p6", name: "Slice of Napoli", cuisine: "Pizza", city: "Mumbai", area: "Bandra", priceLevel: 2, rating: 4.7 },
  { id: "p7", name: "Momo Republic", cuisine: "Momos", city: "Delhi", area: "Hauz Khas", priceLevel: 1, rating: 4.2, sponsored: true, rewardHint: "20% off at 7-day streak" },
  { id: "p8", name: "The Grand Terrace", cuisine: "Brunch", city: "Mumbai", area: "Colaba", priceLevel: 3, rating: 4.9, sponsored: true, rewardHint: "Brunch for two at 30 days (Ultra)" },
];
