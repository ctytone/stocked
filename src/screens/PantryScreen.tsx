import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Item } from '../lib/types'
import { LOCATIONS } from '../lib/types'
import { allocate, fmt, rawUse, stockLevel } from '../lib/planner'
import { shoppingEnd, todayKey } from '../lib/dates'
import { Sheet } from '../components/Sheet'
import { ItemForm } from '../components/ItemForm'
import { DeleteButton } from '../components/DeleteButton'
import { Icon } from '../components/Icon'
import { COMMON_ITEMS } from '../lib/ingredients'
import { useUi } from '../ui'

const LOC_LABEL = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry' }

export function PantryScreen() {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const purchases = useStore((s) => s.purchases)
  const { saveItem, deleteItem, adjustStock } = useStore.getState()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [cooking, setCooking] = useState(false)
  const [quick, setQuick] = useState(() => useUi.getState().intent === 'quick-add')
  useEffect(() => { useUi.getState().clearIntent() }, [])
  const toReview = items.filter((i) => i.needsReview).length
  const today = todayKey()
  const { remaining } = useMemo(
    () => allocate({ items, recipes, meals, purchases }, today, shoppingEnd(today)),
    [items, recipes, meals, purchases, today],
  )

  return (
    <>
      <header className="top">
        <div className="top-title">
          <h1>Pantry</h1>
          <p className="muted">{items.length ? 'What you have at home, in servings' : 'Servings you have at home'}</p>
        </div>
      </header>

      <div className="toolbar">
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add item</button>
        <button className="btn ghost" onClick={() => setQuick(true)}>Quick add</button>
        <button className="btn ghost" onClick={() => setCooking(true)} disabled={recipes.length === 0}>Cook a batch</button>
      </div>

      {items.length === 0 && (
        <div className="empty surface">
          <p>
            <strong>Start with what's in your kitchen.</strong> Each item counts servings: a tub of yogurt might be 8, a loaf
            of bread 10. <em>Quick add</em> fills in common staples for you.
          </p>
        </div>
      )}

      {toReview > 0 && (
        <p className="notice">
          {toReview} item{toReview > 1 ? 's were' : ' was'} added from a recipe with a guessed package size. Tap one marked
          “Check size” to fix it.
        </p>
      )}

      {LOCATIONS.map((loc) => {
        const group = items.filter((i) => i.location === loc).sort((a, b) => a.name.localeCompare(b.name))
        if (group.length === 0) return null
        return (
          <section key={loc}>
            <h2 className="section-label">{LOC_LABEL[loc]}</h2>
            <div className="surface list">
              {group.map((it) => {
                const level = stockLevel(it)
                const left = remaining[it.id] ?? it.stock
                const pct = Math.min(100, (it.stock / it.servingsPerPackage) * 100)
                return (
                  <div key={it.id} className="pantry-row">
                    <button className="pantry-main" onClick={() => setEditing(it)}>
                      <span className="pantry-name">
                        {it.name}
                        {it.needsReview && <span className="chip warn">Check size</span>}
                      </span>
                      <span className={`meter ${level}`} style={{ '--value': `${pct}%` } as React.CSSProperties} />
                      <span className={`pantry-meta ${level}`}>
                        {level === 'out' ? 'Out' : `${fmt(it.stock)} of ${fmt(it.servingsPerPackage)} servings`}
                        {left < -1e-9 && !it.batchOf && <span className="muted"> · need {fmt(-left)} more by Sun</span>}
                      </span>
                    </button>
                    <div className="stepper">
                      <button aria-label={`One less serving of ${it.name}`} onClick={() => adjustStock(it.id, -1)}><Icon name="minus" size={18} /></button>
                      <button aria-label={`One more serving of ${it.name}`} onClick={() => adjustStock(it.id, 1)}><Icon name="plus" size={18} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {editing && (
        <Sheet title={editing === 'new' ? 'Add pantry item' : 'Edit item'} onClose={() => setEditing(null)}>
          <ItemForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : editing}
            onSubmit={(draft) => { saveItem({ ...draft, needsReview: undefined }); setEditing(null) }}
          />
          {editing !== 'new' && (
            <DeleteButton full label="Delete item" onConfirm={() => { deleteItem(editing.id); setEditing(null) }} />
          )}
        </Sheet>
      )}

      {cooking && <CookSheet onClose={() => setCooking(false)} />}
      {quick && <QuickAddSheet onClose={() => setQuick(false)} />}
    </>
  )
}

/** Tap the things you have at home; each is added with one full package on hand. */
function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const items = useStore((s) => s.items)
  const saveItem = useStore((s) => s.saveItem)
  const have = new Set(items.map((i) => i.name.toLowerCase()))
  const choices = COMMON_ITEMS.filter((c) => !have.has(c.name.toLowerCase()))
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (name: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })

  return (
    <Sheet title="Quick add" onClose={onClose}>
      <p className="muted">Tap what you have at home right now. Each one is added with a full package; adjust amounts after.</p>
      {choices.length === 0 ? (
        <p className="muted">You already have all of these.</p>
      ) : (
        <div className="day-chips quick-chips">
          {choices.map((c) => (
            <button key={c.name} className={picked.has(c.name) ? 'on' : ''} aria-pressed={picked.has(c.name)} onClick={() => toggle(c.name)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={picked.size === 0}
          onClick={() => {
            for (const c of choices) if (picked.has(c.name)) saveItem({ ...c, stock: c.servingsPerPackage })
            onClose()
          }}
        >
          Add {picked.size || ''} item{picked.size === 1 ? '' : 's'}
        </button>
      </div>
    </Sheet>
  )
}

function CookSheet({ onClose }: { onClose: () => void }) {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const cook = useStore((s) => s.cook)
  const [recipeId, setRecipeId] = useState<string | null>(null)
  const recipe = recipes.find((r) => r.id === recipeId)

  return (
    <Sheet title="Cook a batch" onClose={onClose}>
      <p className="muted">
        Cooking a whole recipe at once (like a pound of ground beef) moves its ingredients out of the pantry and adds the
        cooked food to your fridge. Planned meals of that recipe use it first.
      </p>
      <div className="options">
        {recipes.map((r) => (
          <button key={r.id} className={`option ${r.id === recipeId ? 'on' : ''}`} onClick={() => setRecipeId(r.id)}>
            {r.name} <span className="muted">· makes {fmt(r.makes)}</span>
          </button>
        ))}
      </div>
      {recipe && (
        <div className="well">
          <p className="group-label">Uses</p>
          {Object.entries(rawUse({ ...recipe, makes: 1 })).map(([id, n]) => {
            const it = items.find((i) => i.id === id)
            const short = it && it.stock < n
            return (
              <p key={id} className={short ? 'warn-text' : ''}>
                {fmt(n)} × {it?.name ?? '?'} {it && <span className="muted">(have {fmt(it.stock)})</span>}
              </p>
            )
          })}
          <p className="group-label">Adds</p>
          <p>{fmt(recipe.makes)} servings of Cooked: {recipe.name}</p>
        </div>
      )}
      <div className="actions">
        <button className="btn primary" disabled={!recipe} onClick={() => { if (recipe) cook(recipe.id); onClose() }}>
          Cooked it
        </button>
      </div>
    </Sheet>
  )
}
