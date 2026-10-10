import { Coffee, Fish, Hamburger, Pizza, type LucideIcon } from 'lucide-react'

export type FoodId = 'pizza' | 'sushi' | 'coffee' | 'burger'

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
    image: '/images/food-pizza.png',
    icon: Pizza,
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    id: 'sushi',
    label: 'Sushi',
    tagline: 'Chopsticks optional',
    image: '/images/food-sushi.png',
    icon: Fish,
    span: 'md:col-span-2',
  },
  {
    id: 'coffee',
    label: 'Coffee',
    tagline: 'A slow sip, a quick chat',
    image: '/images/food-coffee.png',
    icon: Coffee,
    span: 'md:col-span-1',
  },
  {
    id: 'burger',
    label: 'Burger',
    tagline: 'Two hands required',
    image: '/images/food-burger.png',
    icon: Hamburger,
    span: 'md:col-span-1',
  },
]

export const getFood = (id: FoodId | null) => FOODS.find((food) => food.id === id) ?? null
