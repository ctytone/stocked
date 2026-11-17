import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { AppData, Item, Meal, MealType, Recipe } from './lib/types'
import { consumePastMeals, cookBatch, round, toggleSkipped } from './lib/planner'
import { addDays, defaultWeekStart, todayKey } from './lib/dates'

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

// Browser storage can be missing or blocked (private mode, some embeds) — fail quietly.
const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

interface Actions {
  tick: () => void
  saveItem: (item: Omit<Item, 'id'> & { id?: string }) => string
  deleteItem: (id: string) => void
  adjustStock: (id: string, delta: number) => void
  saveRecipe: (recipe: Omit<Recipe, 'id'> & { id?: string }) => string
  deleteRecipe: (id: string) => void
  planMeal: (dates: string[], meal: MealType, kind: Meal['kind'], refId: string) => void
  removeMeal: (id: string) => void
  toggleSkip: (id: string) => void
  buy: (itemId: string, packages: number) => void
  undoPurchase: (id: string) => void
  cook: (recipeId: string) => void
  loadExample: () => void
  replaceData: (data: AppData) => void
}

/** Make sure data from the cloud (or an old save) has every list, even if empty. */
export function normalize(raw: unknown): AppData {
  const d = (raw ?? {}) as Partial<AppData>
  const arr = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : [])
  return { items: arr(d.items), recipes: arr(d.recipes), meals: arr(d.meals), purchases: arr(d.purchases) }
}

export function snapshot(s: AppData): AppData {
  return { items: s.items, recipes: s.recipes, meals: s.meals, purchases: s.purchases }
}

const empty: AppData = { items: [], recipes: [], meals: [], purchases: [] }

export const useStore = create<AppData & Actions>()(
  persist(
    (set, get) => ({
      ...empty,

      tick: () => set((s) => consumePastMeals(s, todayKey())),

      saveItem: (item) => {
        const id = item.id ?? newId()
        set((s) => ({
          items: item.id ? s.items.map((i) => (i.id === id ? { ...i, ...item, id } : i)) : [...s.items, { ...item, id }],
        }))
        return id
      },

      deleteItem: (id) =>
        set((s) => ({
          items: s.items.filter((i) => i.id !== id),
          recipes: s.recipes.map((r) => ({ ...r, ingredients: r.ingredients.filter((g) => g.itemId !== id) })),
          meals: s.meals.filter((m) => !(m.kind === 'item' && m.refId === id && m.status === 'planned')),
        })),

      adjustStock: (id, delta) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, stock: round(Math.max(0, i.stock + delta)) } : i)) })),

      saveRecipe: (recipe) => {
        const id = recipe.id ?? newId()
        set((s) => ({
          recipes: recipe.id ? s.recipes.map((r) => (r.id === id ? { ...recipe, id } : r)) : [...s.recipes, { ...recipe, id }],
          items: s.items.map((i) => (i.batchOf === id ? { ...i, name: `Cooked: ${recipe.name}` } : i)),
        }))
        return id
      },

      deleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          meals: s.meals.filter((m) => !(m.kind === 'recipe' && m.refId === id && m.status === 'planned')),
        })),

      planMeal: (dates, meal, kind, refId) =>
        set((s) => {
          const replace = new Set(dates)
          const kept = s.meals.filter((m) => !(m.meal === meal && replace.has(m.date) && m.status === 'planned'))
          const added = dates.map((date) => ({ id: newId(), date, meal, kind, refId, status: 'planned' as const }))
          return { meals: [...kept, ...added] }
        }),

      removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),

      toggleSkip: (id) => set((s) => toggleSkipped(s, id)),

      buy: (itemId, packages) =>
        set((s) => {
          const item = s.items.find((i) => i.id === itemId)
          if (!item) return {}
          return {
            items: s.items.map((i) => (i.id === itemId ? { ...i, stock: round(i.stock + packages * i.servingsPerPackage) } : i)),
            purchases: [...s.purchases, { id: newId(), itemId, packages, date: todayKey() }].slice(-200),
          }
        }),

      undoPurchase: (id) =>
        set((s) => {
          const p = s.purchases.find((x) => x.id === id)
          if (!p) return {}
          return {
            purchases: s.purchases.filter((x) => x.id !== id),
            items: s.items.map((i) =>
              i.id === p.itemId ? { ...i, stock: round(Math.max(0, i.stock - p.packages * i.servingsPerPackage)) } : i,
            ),
          }
        }),

      cook: (recipeId) => set((s) => cookBatch(s, recipeId, newId)),

      replaceData: (data) => set(normalize(data)),

      loadExample: () => {
        const mon = defaultWeekStart(todayKey())
        const d = (i: number) => addDays(mon, i)
        const items: Item[] = [
          { id: 'ex-yog', name: 'Greek yogurt (tub)', location: 'fridge', servingsPerPackage: 8, stock: 3 },
          { id: 'ex-gran', name: 'Granola', location: 'pantry', servingsPerPackage: 10, stock: 6 },
          { id: 'ex-pot', name: 'Russet potatoes (bag)', location: 'pantry', servingsPerPackage: 4, stock: 0 },
          { id: 'ex-beef', name: 'Ground beef (1 lb)', location: 'fridge', servingsPerPackage: 4, stock: 0 },
          { id: 'ex-pasta', name: 'Spaghetti (box)', location: 'pantry', servingsPerPackage: 8, stock: 8 },
          { id: 'ex-sauce', name: 'Marinara (jar)', location: 'pantry', servingsPerPackage: 4, stock: 0 },
          { id: 'ex-tort', name: 'Tortillas', location: 'pantry', servingsPerPackage: 5, stock: 0 },
          { id: 'ex-bread', name: 'Bread (loaf)', location: 'pantry', servingsPerPackage: 10, stock: 4 },
          { id: 'ex-turkey', name: 'Deli turkey', location: 'fridge', servingsPerPackage: 5, stock: 0 },
        ]
        const recipes: Recipe[] = [
          { id: 'ex-r-yog', name: 'Yogurt & granola', makes: 1, ingredients: [{ itemId: 'ex-yog', servings: 1 }, { itemId: 'ex-gran', servings: 1 }] },
          { id: 'ex-r-bp', name: 'Baked potato', makes: 1, ingredients: [{ itemId: 'ex-pot', servings: 1 }] },
          { id: 'ex-r-spag', name: 'Spaghetti & meatballs', makes: 4, ingredients: [{ itemId: 'ex-pasta', servings: 4 }, { itemId: 'ex-sauce', servings: 4 }, { itemId: 'ex-beef', servings: 2 }] },
          { id: 'ex-r-taco', name: 'Beef tacos', makes: 2, ingredients: [{ itemId: 'ex-beef', servings: 2 }, { itemId: 'ex-tort', servings: 2 }] },
          { id: 'ex-r-sand', name: 'Turkey sandwich', makes: 1, ingredients: [{ itemId: 'ex-bread', servings: 2 }, { itemId: 'ex-turkey', servings: 1 }] },
        ]
        const m = (i: number, meal: MealType, refId: string): Meal => ({ id: newId(), date: d(i), meal, kind: 'recipe', refId, status: 'planned' })
        const meals: Meal[] = [
          ...[0, 1, 2, 3, 4].map((i) => m(i, 'breakfast', 'ex-r-yog')),
          ...[0, 2, 4].map((i) => m(i, 'lunch', 'ex-r-sand')),
          m(0, 'dinner', 'ex-r-spag'), m(1, 'dinner', 'ex-r-bp'), m(2, 'dinner', 'ex-r-taco'),
          m(3, 'dinner', 'ex-r-bp'), m(4, 'dinner', 'ex-r-spag'), m(5, 'dinner', 'ex-r-taco'),
        ]
        const s = get()
        set(consumePastMeals({ items: [...s.items, ...items], recipes: [...s.recipes, ...recipes], meals: [...s.meals, ...meals], purchases: s.purchases }, todayKey()))
      },
    }),
    {
      name: 'meal-planner-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ items: s.items, recipes: s.recipes, meals: s.meals, purchases: s.purchases }),
    },
  ),
)
