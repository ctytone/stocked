import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { AppData, Meal, MealType } from '../lib/types'
import { MEAL_TYPES } from '../lib/types'
import { allocate } from '../lib/planner'
import { addDays, defaultWeekStart, label, todayKey, weekDays } from '../lib/dates'
import { Sheet } from '../components/Sheet'
import { ItemForm } from '../components/ItemForm'

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export function mealName(data: Pick<AppData, 'items' | 'recipes'>, m: Pick<Meal, 'kind' | 'refId'>): string {
  if (m.kind === 'recipe') return data.recipes.find((r) => r.id === m.refId)?.name ?? 'Deleted recipe'
  return data.items.find((i) => i.id === m.refId)?.name ?? 'Deleted item'
}

export function WeekScreen() {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const purchases = useStore((s) => s.purchases)
  const loadExample = useStore((s) => s.loadExample)
  const today = todayKey()
  const [monday, setMonday] = useState(() => defaultWeekStart(today))
  const [open, setOpen] = useState<{ date: string; meal: MealType } | null>(null)

  const days = weekDays(monday)
  const { covered } = useMemo(
    () => allocate({ items, recipes, meals, purchases }, today, '9999-12-31'),
    [items, recipes, meals, purchases, today],
  )
  const slot = (date: string, meal: MealType) => meals.find((m) => m.date === date && m.meal === meal)
  const toBuyCount = meals.filter((m) => m.status === 'planned' && m.date >= today && covered[m.id] === false).length

  return (
    <>
      <header className="top">
        <button className="icon-btn" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week">‹</button>
        <div className="top-title">
          <h1>{label(days[0], { month: 'short', day: 'numeric' })} – {label(days[6], { month: 'short', day: 'numeric' })}</h1>
          <p className="muted">{toBuyCount > 0 ? `${toBuyCount} planned meal${toBuyCount > 1 ? 's' : ''} still need shopping` : 'Everything planned is in stock'}</p>
        </div>
        <button className="icon-btn" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week">›</button>
      </header>

      {meals.length === 0 && items.length === 0 && (
        <div className="empty card">
          <p><strong>Plan your week here.</strong> Tap any meal slot to fill it with a recipe or something from your pantry.</p>
          <button className="btn ghost" onClick={loadExample}>Load an example week</button>
        </div>
      )}

      <div className="days">
        {days.map((date) => {
          const past = date < today
          return (
            <section key={date} className={`day card${date === today ? ' today' : ''}${past ? ' past' : ''}`}>
              <h3>
                {label(date, { weekday: 'long' })}
                <span className="muted"> {label(date, { month: 'short', day: 'numeric' })}</span>
                {date === today && <span className="pill">Today</span>}
              </h3>
              {MEAL_TYPES.map((mt) => {
                const m = slot(date, mt)
                const status = !m ? '' : m.status !== 'planned' ? m.status : covered[m.id] === false ? 'tobuy' : 'ok'
                return (
                  <button
                    key={mt}
                    className={`slot ${m ? 'filled' : 'empty-slot'} ${status}`}
                    disabled={past && !m}
                    onClick={() => setOpen({ date, meal: mt })}
                  >
                    <span className="slot-label">{MEAL_LABEL[mt]}</span>
                    <span className="slot-name">{m ? mealName({ items, recipes }, m) : past ? '—' : '+ Add'}</span>
                    {status === 'tobuy' && <span className="chip warn">To buy</span>}
                    {status === 'eaten' && <span className="chip">Eaten</span>}
                    {status === 'skipped' && <span className="chip muted-chip">Skipped</span>}
                  </button>
                )
              })}
            </section>
          )
        })}
      </div>

      {open && <SlotSheet date={open.date} meal={open.meal} weekDates={days} onClose={() => setOpen(null)} />}
    </>
  )
}

function SlotSheet({ date, meal, weekDates, onClose }: { date: string; meal: MealType; weekDates: string[]; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const { planMeal, removeMeal, toggleSkip, saveItem } = useStore.getState()
  const today = todayKey()
  const existing = meals.find((m) => m.date === date && m.meal === meal)
  const [choice, setChoice] = useState<{ kind: Meal['kind']; refId: string } | null>(
    existing ? { kind: existing.kind, refId: existing.refId } : null,
  )
  const [repeat, setRepeat] = useState<Set<string>>(() => new Set([date]))
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const title = `${label(date, { weekday: 'long' })} · ${MEAL_LABEL[meal]}`

  // A meal from a day that's over: eaten or skipped.
  if (existing && existing.status !== 'planned') {
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="big">{mealName({ items, recipes }, existing)}</p>
        <p className="muted">
          {existing.status === 'eaten'
            ? 'This day is over, so its servings came out of your pantry.'
            : "Marked as not eaten. Its servings are back in your pantry."}
        </p>
        <div className="actions stack">
          <button className="btn primary" onClick={() => { toggleSkip(existing.id); onClose() }}>
            {existing.status === 'eaten' ? "Didn't eat it (put servings back)" : 'Actually, I ate it'}
          </button>
        </div>
      </Sheet>
    )
  }

  const q = query.trim().toLowerCase()
  const recipeOpts = recipes.filter((r) => r.name.toLowerCase().includes(q))
  const itemOpts = items.filter((i) => !i.batchOf && i.name.toLowerCase().includes(q))
  const futureDays = weekDates.filter((d) => d >= today)

  const toggleDay = (d: string) =>
    setRepeat((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  return (
    <Sheet title={title} onClose={onClose}>
      {creating ? (
        <>
          <p className="muted">New pantry item — you can plan it right away and it'll go on your shopping list.</p>
          <ItemForm
            initial={{ name: query, stock: 0 }}
            submitLabel="Add & choose"
            onCancel={() => setCreating(false)}
            onSubmit={(draft) => {
              const id = saveItem(draft)
              setChoice({ kind: 'item', refId: id })
              setCreating(false)
              setQuery('')
            }}
          />
        </>
      ) : (
        <>
          <input className="search" placeholder="Search recipes and pantry…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="options">
            {recipeOpts.length > 0 && <p className="group-label">Recipes</p>}
            {recipeOpts.map((r) => (
              <button
                key={r.id}
                className={`option ${choice?.kind === 'recipe' && choice.refId === r.id ? 'on' : ''}`}
                onClick={() => setChoice({ kind: 'recipe', refId: r.id })}
              >
                {r.name}
              </button>
            ))}
            {itemOpts.length > 0 && <p className="group-label">Pantry items</p>}
            {itemOpts.map((i) => (
              <button
                key={i.id}
                className={`option ${choice?.kind === 'item' && choice.refId === i.id ? 'on' : ''}`}
                onClick={() => setChoice({ kind: 'item', refId: i.id })}
              >
                {i.name}
              </button>
            ))}
            {recipeOpts.length + itemOpts.length === 0 && (
              <p className="muted">{recipes.length + items.length === 0 ? 'No recipes or pantry items yet.' : 'Nothing matches.'}</p>
            )}
            <button className="option add" onClick={() => setCreating(true)}>+ New pantry item{query ? ` “${query}”` : ''}</button>
          </div>

          <p className="group-label">Same {MEAL_LABEL[meal].toLowerCase()} on</p>
          <div className="day-chips">
            {futureDays.map((d) => (
              <button key={d} className={repeat.has(d) ? 'on' : ''} onClick={() => toggleDay(d)}>
                {label(d, { weekday: 'short' })}
              </button>
            ))}
          </div>

          <div className="actions">
            {existing && (
              <button className="btn ghost danger" onClick={() => { removeMeal(existing.id); onClose() }}>Remove</button>
            )}
            <button
              className="btn primary"
              disabled={!choice || repeat.size === 0}
              onClick={() => {
                if (!choice) return
                planMeal([...repeat], meal, choice.kind, choice.refId)
                onClose()
              }}
            >
              Save{repeat.size > 1 ? ` to ${repeat.size} days` : ''}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
