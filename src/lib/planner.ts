import type { AppData, Item, Meal, MealType, Recipe } from './types'
import { MEAL_TYPES } from './types'

const EPS = 1e-9
const mealOrder = (m: MealType) => MEAL_TYPES.indexOf(m)

export function sortMeals(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.date.localeCompare(b.date) || mealOrder(a.meal) - mealOrder(b.meal))
}

export function batchItemFor(items: Item[], recipeId: string): Item | undefined {
  return items.find((i) => i.batchOf === recipeId)
}

/** Servings per pantry item one meal of this recipe uses when cooked from raw ingredients. */
export function rawUse(recipe: Recipe): Record<string, number> {
  const use: Record<string, number> = {}
  const makes = recipe.makes > 0 ? recipe.makes : 1
  for (const ing of recipe.ingredients) {
    use[ing.itemId] = (use[ing.itemId] ?? 0) + ing.servings / makes
  }
  return use
}

/**
 * What one meal takes from the pantry, given current (running) stock.
 * A recipe with a cooked batch on hand uses 1 batch serving; otherwise raw ingredients.
 */
export function mealUse(meal: Meal, data: AppData, running: Record<string, number>): Record<string, number> {
  if (meal.kind === 'item') return { [meal.refId]: 1 }
  const recipe = data.recipes.find((r) => r.id === meal.refId)
  if (!recipe) return {}
  const batch = batchItemFor(data.items, recipe.id)
  if (batch && (running[batch.id] ?? 0) >= 1 - EPS) return { [batch.id]: 1 }
  return rawUse(recipe)
}

export interface Allocation {
  /** meal id -> true when the pantry already covers it */
  covered: Record<string, boolean>
  /** item id -> servings left after all the given planned meals (negative = shortfall) */
  remaining: Record<string, number>
}

/**
 * Walk planned meals in order, taking servings from a copy of the pantry.
 * A meal is "covered" when every ingredient was still in stock when its turn came;
 * otherwise it's "to buy". Earlier meals get first claim on what you own.
 */
export function allocate(data: AppData, from: string, through: string): Allocation {
  const running: Record<string, number> = {}
  for (const it of data.items) running[it.id] = it.stock
  const covered: Record<string, boolean> = {}
  const planned = sortMeals(data.meals.filter((m) => m.status === 'planned' && m.date >= from && m.date <= through))
  for (const meal of planned) {
    const use = mealUse(meal, data, running)
    let ok = true
    for (const [itemId, n] of Object.entries(use)) {
      running[itemId] = (running[itemId] ?? 0) - n
      if (running[itemId] < -EPS) ok = false
    }
    covered[meal.id] = ok
  }
  return { covered, remaining: running }
}

export interface ShoppingLine {
  item: Item
  /** Servings short */
  short: number
  packages: number
}

/** Everything planned from today through the end date, minus what you own, in whole packages. */
export function shoppingList(data: AppData, today: string, through: string): ShoppingLine[] {
  const { remaining } = allocate(data, today, through)
  const lines: ShoppingLine[] = []
  for (const item of data.items) {
    const left = remaining[item.id] ?? item.stock
    if (left < -EPS && !item.batchOf) {
      const short = -left
      const spp = item.servingsPerPackage > 0 ? item.servingsPerPackage : 1
      lines.push({ item, short, packages: Math.ceil(short / spp - EPS) })
    }
  }
  return lines.sort((a, b) => a.item.location.localeCompare(b.item.location) || a.item.name.localeCompare(b.item.name))
}

/** Planned meals from days that have ended become "eaten" and leave the pantry. */
export function consumePastMeals(data: AppData, today: string): AppData {
  const due = sortMeals(data.meals.filter((m) => m.status === 'planned' && m.date < today))
  if (due.length === 0) return data
  const stock: Record<string, number> = {}
  for (const it of data.items) stock[it.id] = it.stock
  const updated = new Map<string, Meal>()
  for (const meal of due) {
    const use = mealUse(meal, data, stock)
    const used: Record<string, number> = {}
    for (const [itemId, n] of Object.entries(use)) {
      if (!(itemId in stock)) continue
      const take = Math.min(n, Math.max(0, stock[itemId]))
      stock[itemId] = round(stock[itemId] - take)
      used[itemId] = take
    }
    updated.set(meal.id, { ...meal, status: 'eaten', used })
  }
  return {
    ...data,
    items: data.items.map((it) => ({ ...it, stock: stock[it.id] })),
    meals: data.meals.map((m) => updated.get(m.id) ?? m),
  }
}

/** "Didn't eat it": put the servings back. Calling it again re-marks it eaten. */
export function toggleSkipped(data: AppData, mealId: string): AppData {
  const meal = data.meals.find((m) => m.id === mealId)
  if (!meal || meal.status === 'planned') return data
  const items = data.items.map((it) => ({ ...it }))
  const byId = new Map(items.map((i) => [i.id, i]))
  let next: Meal
  if (meal.status === 'eaten') {
    for (const [itemId, n] of Object.entries(meal.used ?? {})) {
      const it = byId.get(itemId)
      if (it) it.stock = round(it.stock + n)
    }
    next = { ...meal, status: 'skipped' }
  } else {
    const stock: Record<string, number> = {}
    for (const it of items) stock[it.id] = it.stock
    const used: Record<string, number> = {}
    for (const [itemId, n] of Object.entries(mealUse(meal, data, stock))) {
      const it = byId.get(itemId)
      if (!it) continue
      const take = Math.min(n, Math.max(0, it.stock))
      it.stock = round(it.stock - take)
      used[itemId] = take
    }
    next = { ...meal, status: 'eaten', used }
  }
  return { ...data, items, meals: data.meals.map((m) => (m.id === mealId ? next : m)) }
}

/** Cook a full batch: raw ingredients leave the pantry, "Cooked: X" with `makes` servings arrives. */
export function cookBatch(data: AppData, recipeId: string, newId: () => string): AppData {
  const recipe = data.recipes.find((r) => r.id === recipeId)
  if (!recipe) return data
  const items = data.items.map((it) => ({ ...it }))
  for (const ing of recipe.ingredients) {
    const it = items.find((i) => i.id === ing.itemId)
    if (it) it.stock = round(Math.max(0, it.stock - ing.servings))
  }
  const batch = items.find((i) => i.batchOf === recipe.id)
  if (batch) {
    batch.stock = round(batch.stock + recipe.makes)
    batch.name = `Cooked: ${recipe.name}`
  } else {
    items.push({
      id: newId(),
      name: `Cooked: ${recipe.name}`,
      location: 'fridge',
      servingsPerPackage: recipe.makes,
      stock: recipe.makes,
      batchOf: recipe.id,
    })
  }
  return { ...data, items }
}

export type StockLevel = 'ok' | 'low' | 'out'

/** Yellow under half a package, red when out. */
export function stockLevel(item: Item): StockLevel {
  if (item.stock <= EPS) return 'out'
  if (item.stock < item.servingsPerPackage / 2 - EPS) return 'low'
  return 'ok'
}

export function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function fmt(n: number): string {
  const r = round(n)
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
