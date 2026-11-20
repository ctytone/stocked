import { useMemo } from 'react'
import { useStore } from '../store'
import { fmt, shoppingList, stockLevel } from '../lib/planner'
import { label, shoppingEnd, todayKey } from '../lib/dates'

export function ShopScreen() {
  const items = useStore((s) => s.items)
  const recipes = useStore((s) => s.recipes)
  const meals = useStore((s) => s.meals)
  const purchases = useStore((s) => s.purchases)
  const { buy, undoPurchase } = useStore.getState()
  const today = todayKey()
  const end = shoppingEnd(today)
  const lines = useMemo(
    () => shoppingList({ items, recipes, meals, purchases }, today, end),
    [items, recipes, meals, purchases, today, end],
  )
  const needed = new Set(lines.map((l) => l.item.id))
  const boughtToday = purchases.filter((p) => p.date === today).reverse()
  const low = items.filter((i) => !i.batchOf && !needed.has(i.id) && stockLevel(i) !== 'ok')

  return (
    <>
      <header className="top">
        <div className="top-title">
          <h1>Shopping list</h1>
          <p className="muted">Everything planned through {label(end, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
      </header>

      {lines.length === 0 ? (
        <div className="empty surface">
          <p><strong>Nothing to buy.</strong> Your pantry covers every meal planned through {label(end, { weekday: 'long' })}.</p>
        </div>
      ) : (
        <div className="surface list">
          {lines.map(({ item, short, packages }) => (
            <label key={item.id} className="shop-row">
              <input type="checkbox" checked={false} onChange={() => buy(item.id, packages)} />
              <span className="shop-main">
                <span className="shop-name">{item.name}</span>
                <span className="muted">
                  Buy {packages} ({fmt(packages * item.servingsPerPackage)} servings) · you need {fmt(short)} more
                </span>
              </span>
              <span className="loc">{item.location}</span>
            </label>
          ))}
        </div>
      )}
      <p className="hint">Checking an item adds it to your pantry.</p>

      {boughtToday.length > 0 && (
        <section>
          <h2 className="section-label">Bought today</h2>
          <div className="surface list">
            {boughtToday.map((p) => {
              const it = items.find((i) => i.id === p.itemId)
              return (
                <div key={p.id} className="shop-row done">
                  <span className="check">✓</span>
                  <span className="shop-main">
                    <span className="shop-name">{it?.name ?? 'Deleted item'}</span>
                    <span className="muted">{p.packages} package{p.packages > 1 ? 's' : ''} added to pantry</span>
                  </span>
                  <button className="btn ghost small" onClick={() => undoPurchase(p.id)}>Undo</button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {low.length > 0 && (
        <section>
          <h2 className="section-label">Running low (not needed this week)</h2>
          <div className="surface list">
            {low.map((it) => (
              <div key={it.id} className="shop-row">
                <span className={`dot ${stockLevel(it)}`} />
                <span className="shop-main">
                  <span className="shop-name">{it.name}</span>
                  <span className="muted">{stockLevel(it) === 'out' ? 'Out' : `${fmt(it.stock)} servings left`}</span>
                </span>
                <button className="btn ghost small" onClick={() => buy(it.id, 1)}>Bought 1</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
