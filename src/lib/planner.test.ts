import { describe, expect, it } from 'vitest'
import type { AppData, Meal } from './types'
import { allocate, consumePastMeals, cookBatch, shoppingList, stockLevel, toggleSkipped } from './planner'
import { defaultWeekStart, mondayOf, shoppingEnd } from './dates'

const yogurt = { id: 'yog', name: 'Yogurt', location: 'fridge' as const, servingsPerPackage: 8, stock: 0 }
const potatoes = { id: 'pot', name: 'Potatoes', location: 'pantry' as const, servingsPerPackage: 4, stock: 0 }
const beef = { id: 'beef', name: 'Ground beef', location: 'fridge' as const, servingsPerPackage: 4, stock: 0 }
const bakedPotato = { id: 'bp', name: 'Baked potato', makes: 1, ingredients: [{ itemId: 'pot', servings: 1 }] }
const tacoMeat = { id: 'taco', name: 'Taco meat', makes: 4, ingredients: [{ itemId: 'beef', servings: 4 }] }

let n = 0
const meal = (date: string, m: Meal['meal'], kind: Meal['kind'], refId: string): Meal => ({
  id: `m${n++}`, date, meal: m, kind, refId, status: 'planned',
})

const base = (meals: Meal[], stock: Record<string, number> = {}): AppData => ({
  items: [yogurt, potatoes, beef].map((i) => ({ ...i, stock: stock[i.id] ?? 0 })),
  recipes: [bakedPotato, tacoMeat],
  meals,
  purchases: [],
})

// Sunday Nov 15 2026 is shopping day; week is Mon 16 – Sun 22
const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']

describe('dates', () => {
  it('Sunday shopping covers through next Sunday', () => {
    expect(shoppingEnd('2026-11-15')).toBe('2026-11-22')
    expect(shoppingEnd('2026-11-18')).toBe('2026-11-22')
  })
  it('weeks run Monday to Sunday; on Sunday show the coming week', () => {
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
    expect(defaultWeekStart('2026-11-15')).toBe('2026-11-16')
    expect(defaultWeekStart('2026-11-18')).toBe('2026-11-16')
  })
})

describe('shopping list', () => {
  it('yogurt Mon–Fri with an empty fridge: buy 1 tub', () => {
    const data = base(week.slice(0, 5).map((d) => meal(d, 'breakfast', 'item', 'yog')))
    const list = shoppingList(data, '2026-11-15', '2026-11-22')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ short: 5, packages: 1 })
  })

  it('3 yogurt servings left and 5 planned: still buy 1 tub; with 8 left buy nothing', () => {
    const meals = week.slice(0, 5).map((d) => meal(d, 'breakfast', 'item', 'yog'))
    expect(shoppingList(base(meals, { yog: 3 }), '2026-11-15', '2026-11-22')[0].packages).toBe(1)
    expect(shoppingList(base(meals, { yog: 8 }), '2026-11-15', '2026-11-22')).toHaveLength(0)
  })

  it('baked potatoes Tue + Thu: one 4-serving bag, and none next week while 2 remain', () => {
    const meals = [meal(week[1], 'dinner', 'recipe', 'bp'), meal(week[3], 'dinner', 'recipe', 'bp')]
    expect(shoppingList(base(meals), '2026-11-15', '2026-11-22')[0].packages).toBe(1)
    expect(shoppingList(base(meals, { pot: 4 }), '2026-11-15', '2026-11-22')).toHaveLength(0)
  })

  it('taco meat 4 nights uses one 4-serving pack of beef', () => {
    const meals = week.slice(0, 4).map((d) => meal(d, 'dinner', 'recipe', 'taco'))
    expect(shoppingList(base(meals), '2026-11-15', '2026-11-22')[0]).toMatchObject({ item: { id: 'beef' }, packages: 1 })
  })

  it('9 yogurt days: first 8 covered by a full tub, 9th is "to buy"', () => {
    const days = [...week, '2026-11-23', '2026-11-24']
    const meals = days.map((d) => meal(d, 'breakfast', 'item', 'yog'))
    const { covered } = allocate(base(meals, { yog: 8 }), '2026-11-15', '2026-12-31')
    expect(meals.map((m) => covered[m.id])).toEqual([true, true, true, true, true, true, true, true, false])
  })
})

describe('eating and skipping', () => {
  it('past days are eaten automatically; "didn\'t eat it" puts servings back', () => {
    const meals = week.slice(0, 3).map((d) => meal(d, 'breakfast', 'item', 'yog'))
    let data = consumePastMeals(base(meals, { yog: 8 }), '2026-11-18') // Mon + Tue are past
    expect(data.items.find((i) => i.id === 'yog')!.stock).toBe(6)
    expect(data.meals.map((m) => m.status)).toEqual(['eaten', 'eaten', 'planned'])
    data = toggleSkipped(data, meals[1].id)
    expect(data.items.find((i) => i.id === 'yog')!.stock).toBe(7)
    data = toggleSkipped(data, meals[1].id)
    expect(data.items.find((i) => i.id === 'yog')!.stock).toBe(6)
  })

  it('never goes below zero', () => {
    const meals = week.slice(0, 3).map((d) => meal(d, 'breakfast', 'item', 'yog'))
    const data = consumePastMeals(base(meals, { yog: 1 }), '2026-11-20')
    expect(data.items.find((i) => i.id === 'yog')!.stock).toBe(0)
  })
})

describe('batch cooking', () => {
  it('cooking taco meat turns 4 beef servings into 4 cooked servings, which meals use first', () => {
    let k = 0
    const meals = week.slice(0, 2).map((d) => meal(d, 'dinner', 'recipe', 'taco'))
    let data = cookBatch(base(meals, { beef: 4 }), 'taco', () => `batch${k++}`)
    const batch = data.items.find((i) => i.batchOf === 'taco')!
    expect(batch.stock).toBe(4)
    expect(data.items.find((i) => i.id === 'beef')!.stock).toBe(0)
    expect(shoppingList(data, '2026-11-15', '2026-11-22')).toHaveLength(0)
    data = consumePastMeals(data, '2026-11-18')
    expect(data.items.find((i) => i.batchOf === 'taco')!.stock).toBe(2)
  })
})

describe('stock colors', () => {
  it('yellow under half a package, red at zero', () => {
    expect(stockLevel({ ...yogurt, stock: 5 })).toBe('ok')
    expect(stockLevel({ ...yogurt, stock: 3 })).toBe('low')
    expect(stockLevel({ ...yogurt, stock: 0 })).toBe('out')
  })
})
