import {
  Coffee,
  Fish,
  Hamburger,
  IceCream,
  Pizza,
  Soup,
  CupSoda,
  UtensilsCrossed,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type FoodId =
  | 'pizza'
  | 'sushi'
  | 'coffee'
  | 'burger'
  | 'biryani'
  | 'dosa'
  | 'chai'
  | 'icecream'
  | 'custom'

export interface Food {
  id: FoodId
  label: string
  tagline: string
  image: string
  icon: LucideIcon
  /** Bento grid placement classes (desktop) */
  span: string
}

export const FOODS: Food[] = [
  {
    id: 'pizza',
    label: 'Pizza',
    tagline: 'Cheese pulls & crust debates',
    image: '/images/food-pizza.webp',
    icon: Pizza,
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    id: 'biryani',
    label: 'Biryani',
    tagline: 'Spice level negotiations',
    image: '/images/food-biryani.svg',
    icon: Soup,
    span: 'md:col-span-2',
  },
  {
    id: 'dosa',
    label: 'Dosa',
    tagline: 'Crisp, golden, shareable',
    image: '/images/food-dosa.svg',
    icon: UtensilsCrossed,
    span: 'md:col-span-1',
  },
  {
    id: 'chai',
    label: 'Chai',
    tagline: 'Cutting chai conversations',
    image: '/images/food-chai.svg',
    icon: CupSoda,
    span: 'md:col-span-1',
  },
  {
    id: 'sushi',
    label: 'Sushi',
    tagline: 'Chopsticks optional',
    image: '/images/food-sushi.webp',
    icon: Fish,
    span: 'md:col-span-1',
  },
  {
    id: 'coffee',
    label: 'Coffee',
    tagline: 'A slow sip, a quick chat',
    image: '/images/food-coffee.webp',
    icon: Coffee,
    span: 'md:col-span-1',
  },
  {
    id: 'burger',
    label: 'Burger',
    tagline: 'Two hands required',
    image: '/images/food-burger.webp',
    icon: Hamburger,
    span: 'md:col-span-1',
  },
  {
    id: 'icecream',
    label: 'Ice cream',
    tagline: 'Sweet tooth meet-cute',
    image: '/images/food-icecream.svg',
    icon: IceCream,
    span: 'md:col-span-1',
  },
  {
    id: 'custom',
    label: 'Something else',
    tagline: 'Name your craving',
    image: '/images/food-custom.svg',
    icon: Sparkles,
    span: 'md:col-span-1',
  },
]

export const getFood = (id: FoodId | null) => FOODS.find((food) => food.id === id) ?? null

export const ICEBREAKERS: Record<string, string[]> = {
  pizza: ['Thin crust or deep dish?', 'Pineapple: controversial or correct?', 'Last great pizza place you tried?'],
  sushi: ['Roll or sashimi first?', 'Wasabi dab or mix?', 'Favorite non-fish roll?'],
  coffee: ['Milk or black?', 'Best cafe within 2 km?', 'Cold brew or hot?'],
  burger: ['Cheese mandatory?', 'Fries shared or sacred?', 'Smash or thick patty?'],
  biryani: ['Hyderabadi or Lucknowi?', 'Raita essential?', 'Spice level 1–10?'],
  dosa: ['Masala or plain?', 'Chutney ranking?', 'Filter coffee after?'],
  chai: ['Adrak or elaichi?', 'Cutting or full cup?', 'Biscuit dunking — yes/no?'],
  icecream: ['Cone or cup?', 'Chocolate overload or fruit?', 'Last scoop you craved?'],
  custom: ['What made you pick this craving?', 'First food memory?', 'Would you cook this together someday?'],
}

export function icebreakersFor(foodId: string | null): string[] {
  if (!foodId) return ICEBREAKERS.custom
  return ICEBREAKERS[foodId] || ICEBREAKERS.custom
}
