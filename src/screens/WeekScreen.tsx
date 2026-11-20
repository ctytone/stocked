import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import type { AppData, Meal, MealType } from '../lib/types'
import { MEAL_TYPES } from '../lib/types'
import { allocate, batchItemFor, fmt } from '../lib/planner'
import { addDays, defaultWeekStart, label, todayKey, weekDays } from '../lib/dates'
import { ingredientName } from '../lib/ingredients'
import { useUi } from '../ui'
import { Sheet } from '../components/Sheet'
import { ItemForm } from '../components/ItemForm'
import { Icon } from '../components/Icon'

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export function mealName(data: Pick<AppData, 'items' | 'recipes'>, m: Pick<Meal, 'kind' | 'refId'>): string {
  if (m.kind === 'recipe') return data.recipes.find((r) => r.id === m.refId)?.name ?? 'Deleted recipe'
  return data.items.find((i) => i.id === m.refId)?.name ?? 'Deleted item'
}

type SlotStatus = '' | 'ok' | 'tobuy' | 'eaten' | 'skipped'

function useWide(query = '(min-width: 900px)') {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return wide
}

export function WeekScreen() {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const purchases = useStore((s) => s.purchases)
  const today = todayKey()
  const wide = useWide()
  const [monday, setMonday] = useState(() => defaultWeekStart(today))
  const [selected, setSelected] = useState(today)
  const [open, setOpen] = useState<{ date: string; meal: MealType; choose?: boolean } | null>(null)

  const days = weekDays(monday)
  const day = days.includes(selected) ? selected : days.includes(today) ? today : days[0]
  const { covered } = useMemo(
    () => allocate({ items, recipes, meals, purchases }, today, '9999-12-31'),
    [items, recipes, meals, purchases, today],
  )
  const slot = (date: string, meal: MealType) => meals.find((m) => m.date === date && m.meal === meal)
  const statusOf = (m?: Meal): SlotStatus =>
    !m ? '' : m.status !== 'planned' ? m.status : covered[m.id] === false ? 'tobuy' : 'ok'
  const toBuyCount = meals.filter((m) => m.status === 'planned' && m.date >= today && covered[m.id] === false).length

  const moveWeek = (n: number) => {
    const next = addDays(monday, 7 * n)
    setMonday(next)
    setSelected(weekDays(next).includes(today) ? today : next)
  }

  const renderSlot = (date: string, mt: MealType, compact = false) => {
    const m = slot(date, mt)
    const status = statusOf(m)
    const past = date < today
    return (
      <button
        key={mt}
        className={`slot ${m ? 'filled' : 'empty-slot'} ${status}${compact ? ' compact' : ''}`}
        disabled={past && !m}
        onClick={() => setOpen({ date, meal: mt })}
        aria-label={`${label(date, { weekday: 'long' })} ${MEAL_LABEL[mt]}: ${m ? mealName({ items, recipes }, m) : 'empty'}`}
      >
        <span className="slot-label">{MEAL_LABEL[mt]}</span>
        <span className="slot-name">{m ? mealName({ items, recipes }, m) : past ? '—' : '+ Add'}</span>
        {status === 'tobuy' && <span className="chip warn">To buy</span>}
        {status === 'eaten' && <span className="chip ok">Eaten</span>}
        {status === 'skipped' && <span className="chip muted-chip">Skipped</span>}
      </button>
    )
  }

  return (
    <>
      <header className="top">
        <button className="icon-btn" onClick={() => moveWeek(-1)} aria-label="Previous week"><Icon name="chevronLeft" /></button>
        <div className="top-title">
          <h1>{label(days[0], { month: 'short', day: 'numeric' })} – {label(days[6], { month: 'short', day: 'numeric' })}</h1>
          <p className="muted">
            {toBuyCount > 0 ? (
              <span className="stat--warn">{toBuyCount} planned meal{toBuyCount > 1 ? 's' : ''} still need shopping</span>
            ) : meals.some((m) => m.status === 'planned' && m.date >= today) ? (
              <span className="stat--up">Everything planned is in stock</span>
            ) : (
              'Tap a meal to plan it'
            )}
          </p>
        </div>
        <button className="icon-btn" onClick={() => moveWeek(1)} aria-label="Next week"><Icon name="chevronRight" /></button>
      </header>

      <GettingStarted />

      {wide ? (
        <div className="week-grid">
          {days.map((date) => (
            <section
              key={date}
              className={`grid-day surface${date === today ? ' today' : ''}${date < today ? ' past' : ''}`}
              aria-label={label(date, { weekday: 'long', month: 'long', day: 'numeric' })}
            >
              <h3 className="grid-day-head">
                <span className="wd">{label(date, { weekday: 'short' })}</span>
                <span className="dn">{label(date, { day: 'numeric' })}</span>
              </h3>
              {MEAL_TYPES.map((mt) => renderSlot(date, mt, true))}
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="strip well" role="tablist" aria-label="Days of the week">
            {days.map((date) => (
              <button
                key={date}
                role="tab"
                aria-selected={date === day}
                aria-label={label(date, { weekday: 'long', month: 'long', day: 'numeric' })}
                className={`strip-day${date === day ? ' on' : ''}${date === today ? ' today' : ''}${date < today ? ' past' : ''}`}
                onClick={() => setSelected(date)}
              >
                <span className="wd">{label(date, { weekday: 'narrow' })}</span>
                <span className="dn">{label(date, { day: 'numeric' })}</span>
                <span className="dots" aria-hidden="true">
                  {MEAL_TYPES.map((mt) => <span key={mt} className={`dot-s ${statusOf(slot(date, mt)) || 'none'}`} />)}
                </span>
              </button>
            ))}
          </div>

          <section className={`day surface${day === today ? ' today' : ''}${day < today ? ' past' : ''}`}>
            <h2 className="day-head">
              {label(day, { weekday: 'long' })}
              <span className="muted"> {label(day, { month: 'long', day: 'numeric' })}</span>
              {day === today && <span className="pill">Today</span>}
            </h2>
            {MEAL_TYPES.map((mt) => renderSlot(day, mt))}
          </section>
          <p className="legend" aria-hidden="true">
            <span><span className="dot-s ok" /> In stock</span>
            <span><span className="dot-s tobuy" /> To buy</span>
            <span><span className="dot-s eaten" /> Eaten</span>
          </p>
        </>
      )}

      {open && (() => {
        const existing = slot(open.date, open.meal)
        if (existing && !open.choose) {
          return (
            <MealSheet
              meal={existing}
              covered={covered[existing.id] !== false}
              onChange={() => setOpen({ ...open, choose: true })}
              onClose={() => setOpen(null)}
            />
          )
        }
        return <SlotSheet date={open.date} meal={open.meal} weekDates={days} onClose={() => setOpen(null)} />
      })()}
    </>
  )
}

/** First-run checklist: pantry → recipe → plan → shop. Disappears once dismissed. */
function GettingStarted() {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const loadExample = useStore((s) => s.loadExample)
  const { onboarding, go, dismissOnboarding } = useUi()
  if (onboarding.dismissed) return null

  const steps = [
    { done: items.some((i) => !i.batchOf), title: "Add what's in your kitchen", hint: 'Tap the staples you have.', action: () => go('pantry', 'quick-add'), cta: 'Quick add' },
    { done: recipes.length > 0, title: 'Add a recipe', hint: 'Paste a link. Missing ingredients go to your pantry list.', action: () => go('recipes', 'add-recipe'), cta: 'Add recipe' },
    { done: meals.length > 0, title: 'Plan a meal', hint: 'Tap any empty slot below.', action: undefined, cta: '' },
    { done: !!onboarding.shopped, title: 'Check your shopping list', hint: 'Only what your plan needs and you don’t have.', action: () => go('shop'), cta: 'Open list' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const brandNew = items.length === 0 && recipes.length === 0 && meals.length === 0

  return (
    <section className="onboard surface" aria-labelledby="onboard-title">
      <div className="onboard-head">
        <div>
          <h2 id="onboard-title">{doneCount === steps.length ? "You're all set" : 'Get started'}</h2>
          <p className="muted">{doneCount} of {steps.length} done</p>
        </div>
        <button className="text-btn" onClick={dismissOnboarding}>{doneCount === steps.length ? 'Done' : 'Hide'}</button>
      </div>
      <div className="meter" style={{ '--value': `${(doneCount / steps.length) * 100}%` } as React.CSSProperties} aria-hidden="true" />
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'done' : ''}>
            <span className="step-mark" aria-hidden="true">{s.done ? <Icon name="check" size={16} /> : i + 1}</span>
            <span className="step-text">
              <span className="step-title">{s.title}{s.done && <span className="sr-only"> (done)</span>}</span>
              {!s.done && <span className="muted">{s.hint}</span>}
            </span>
            {!s.done && s.action && <button className="btn small" onClick={s.action}>{s.cta}</button>}
          </li>
        ))}
      </ol>
      {brandNew && (
        <button className="text-btn" onClick={loadExample}>Or look around with an example week first</button>
      )}
    </section>
  )
}

/** Tapping a planned meal: what it is, what it uses vs. what you have, the steps, and "I ate it". */
function MealSheet({ meal, covered, onChange, onClose }: { meal: Meal; covered: boolean; onChange: () => void; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const { eat, toggleSkip, removeMeal } = useStore.getState()
  const today = todayKey()
  const title = `${label(meal.date, { weekday: 'long' })} · ${MEAL_LABEL[meal.meal]}`
  const recipe = meal.kind === 'recipe' ? recipes.find((r) => r.id === meal.refId) : undefined
  const item = meal.kind === 'item' ? items.find((i) => i.id === meal.refId) : undefined
  const batch = recipe ? batchItemFor(items, recipe.id) : undefined
  const useBatch = !!batch && batch.stock >= 1 && meal.status === 'planned'
  const canEat = meal.status === 'planned' && meal.date <= today
  const makes = recipe && recipe.makes > 0 ? recipe.makes : 1

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="big">{mealName({ items, recipes }, meal)}</p>
      <p className="muted meal-sub">
        {meal.status === 'eaten' && <span className="stat--up">Eaten. Its servings came out of your pantry.</span>}
        {meal.status === 'skipped' && 'Marked as not eaten. Its servings are back in your pantry.'}
        {meal.status === 'planned' && (covered
          ? <span className="stat--up">You have everything for this.</span>
          : <span className="stat--warn">Some of this is on your shopping list.</span>)}
        {recipe && <> · Makes {fmt(recipe.makes)}, this meal is 1 of them</>}
      </p>

      {useBatch && batch && (
        <p className="notice">Using your cooked batch: {fmt(batch.stock)} serving{batch.stock === 1 ? '' : 's'} left.</p>
      )}

      {item && (
        <div className="well compare">
          <CompareRow name={item.name} need={1} have={item.stock} />
        </div>
      )}

      {recipe && recipe.ingredients.length > 0 && (
        <>
          <h3 className="group-label">Ingredients for this meal</h3>
          <ul className="well compare">
            {recipe.ingredients.map((g, i) => {
              const it = g.itemId ? items.find((x) => x.id === g.itemId) : undefined
              return it ? (
                <CompareRow key={i} name={it.name} detail={g.text} need={g.servings / makes} have={it.stock} dim={useBatch} />
              ) : (
                <li key={i} className="cmp untracked">
                  <span className="cmp-mark" aria-hidden="true">·</span>
                  <span className="cmp-main"><span>{g.text ? ingredientName(g.text) : 'Ingredient'}</span>{g.text && <span className="muted">{g.text}</span>}</span>
                  <span className="muted cmp-num">not tracked</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {recipe?.steps && recipe.steps.length > 0 && (
        <>
          <h3 className="group-label">Steps</h3>
          <ol className="recipe-steps">
            {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}
      {recipe?.notes && <p className="hint">{recipe.notes}</p>}
      {recipe?.url && (
        <a className="link" href={recipe.url} target="_blank" rel="noreferrer">Open original recipe <Icon name="link" size={16} /></a>
      )}

      <div className="actions">
        {meal.status === 'planned' ? (
          <>
            <button className="btn ghost danger" onClick={() => { removeMeal(meal.id); onClose() }}>Remove</button>
            <button className="btn ghost" onClick={onChange}>Change</button>
            {canEat && <button className="btn primary" onClick={() => { eat(meal.id); onClose() }}>I ate it</button>}
          </>
        ) : (
          <button className="btn primary" onClick={() => { toggleSkip(meal.id); onClose() }}>
            {meal.status === 'eaten' ? "Didn't eat it (put servings back)" : 'Actually, I ate it'}
          </button>
        )}
      </div>
      {meal.status === 'planned' && (
        <p className="hint">
          {canEat
            ? 'Tap “I ate it” to take it out of your pantry now. Otherwise it happens automatically when the day ends.'
            : 'When this day ends, these servings come out of your pantry automatically.'}
        </p>
      )}
    </Sheet>
  )
}

function CompareRow({ name, detail, need, have, dim }: { name: string; detail?: string; need: number; have: number; dim?: boolean }) {
  const ok = have + 1e-9 >= need
  return (
    <li className={`cmp ${ok ? 'have' : 'short'}${dim ? ' dim' : ''}`}>
      <span className="cmp-mark" aria-hidden="true"><Icon name={ok ? 'check' : 'alert'} size={16} /></span>
      <span className="cmp-main">
        <span>{name}</span>
        {detail && <span className="muted">{detail}</span>}
      </span>
      <span className={`cmp-num ${ok ? 'stat--up' : 'stat--warn'}`}>
        needs {fmt(need)} · have {fmt(have)}
        <span className="sr-only">{ok ? ' (enough)' : ' (not enough)'}</span>
      </span>
    </li>
  )
}

function SlotSheet({ date, meal, weekDates, onClose }: { date: string; meal: MealType; weekDates: string[]; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const { planMeal, removeMeal, saveItem } = useStore.getState()
  const today = todayKey()
  const existing = meals.find((m) => m.date === date && m.meal === meal)
  const [choice, setChoice] = useState<{ kind: Meal['kind']; refId: string } | null>(
    existing ? { kind: existing.kind, refId: existing.refId } : null,
  )
  const [repeat, setRepeat] = useState<Set<string>>(() => new Set([date]))
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const title = `${label(date, { weekday: 'long' })} · ${MEAL_LABEL[meal]}`

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
          <p className="muted">New pantry item. You can plan it right away and it'll go on your shopping list.</p>
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
          <input
            className="search"
            placeholder="Search recipes and pantry…"
            aria-label="Search recipes and pantry"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="options">
            {recipeOpts.length > 0 && <p className="group-label">Recipes</p>}
            {recipeOpts.map((r) => (
              <button
                key={r.id}
                className={`option ${choice?.kind === 'recipe' && choice.refId === r.id ? 'on' : ''}`}
                aria-pressed={choice?.kind === 'recipe' && choice.refId === r.id}
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
                aria-pressed={choice?.kind === 'item' && choice.refId === i.id}
                onClick={() => setChoice({ kind: 'item', refId: i.id })}
              >
                {i.name} <span className="muted">· {fmt(i.stock)} on hand</span>
              </button>
            ))}
            {recipeOpts.length + itemOpts.length === 0 && (
              <p className="muted">{recipes.length + items.length === 0 ? 'No recipes or pantry items yet.' : 'Nothing matches.'}</p>
            )}
            <button className="option add" onClick={() => setCreating(true)}>+ New pantry item{query ? ` “${query}”` : ''}</button>
          </div>

          {futureDays.length > 1 && (
            <>
              <p className="group-label">Same {MEAL_LABEL[meal].toLowerCase()} on</p>
              <div className="day-chips">
                {futureDays.map((d) => (
                  <button key={d} className={repeat.has(d) ? 'on' : ''} aria-pressed={repeat.has(d)} onClick={() => toggleDay(d)}>
                    {label(d, { weekday: 'short' })}
                  </button>
                ))}
              </div>
            </>
          )}

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
