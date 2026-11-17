export type Location = 'fridge' | 'freezer' | 'pantry'
export type MealType = 'breakfast' | 'lunch' | 'dinner'
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']
export const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry']

/** Something you buy and keep: a tub of yogurt, a bag of potatoes, or a cooked batch. */
export interface Item {
  id: string
  name: string
  location: Location
  servingsPerPackage: number
  /** Servings you have right now. */
  stock: number
  /** Set when this item is a cooked batch of a recipe. */
  batchOf?: string
}

export interface Ingredient {
  itemId: string
  /** Servings of the item the whole recipe uses. */
  servings: number
}

export interface Recipe {
  id: string
  name: string
  url?: string
  /** How many meals one batch of this recipe makes. */
  makes: number
  ingredients: Ingredient[]
  notes?: string
}

export type MealStatus = 'planned' | 'eaten' | 'skipped'

export interface Meal {
  id: string
  /** Local date, YYYY-MM-DD */
  date: string
  meal: MealType
  kind: 'recipe' | 'item'
  refId: string
  status: MealStatus
  /** Servings actually taken from the pantry when it was eaten (so "didn't eat it" can put them back). */
  used?: Record<string, number>
}

export interface Purchase {
  id: string
  itemId: string
  packages: number
  date: string
}

export interface AppData {
  items: Item[]
  recipes: Recipe[]
  meals: Meal[]
  purchases: Purchase[]
}
