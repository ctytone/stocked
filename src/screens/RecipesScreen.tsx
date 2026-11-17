import { useState } from 'react'
import { useStore } from '../store'
import type { Item, Recipe } from '../lib/types'
import { fmt } from '../lib/planner'
import { Sheet } from '../components/Sheet'
import { ItemForm } from '../components/ItemForm'
import { DeleteButton } from '../components/DeleteButton'

interface Row {
  key: string
  /** Original line from the website, if imported */
  text?: string
  itemId: string
  servings: string
}

interface Draft {
  id?: string
  name: string
  url?: string
  makes: string
  notes?: string
  rows: Row[]
}

let rowKey = 0
const newRow = (r: Partial<Row> = {}): Row => ({ key: `r${rowKey++}`, itemId: '', servings: '1', ...r })

/** Guess which pantry item an imported line like "1 lb lean ground beef" refers to. */
function guessItem(line: string, items: Item[]): string {
  const text = line.toLowerCase()
  let best = ''
  let bestScore = 0
  for (const it of items) {
    if (it.batchOf) continue
    const words = it.name.toLowerCase().replace(/\(.*?\)/g, '').split(/\W+/).filter((w) => w.length > 2)
    const score = words.filter((w) => text.includes(w)).length / (words.length || 1)
    if (score > bestScore) { bestScore = score; best = it.id }
  }
  return bestScore >= 0.5 ? best : ''
}

export function RecipesScreen() {
  const recipes = useStore((s) => s.recipes)
  const items = useStore((s) => s.items)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [adding, setAdding] = useState(false)

  const open = (r: Recipe) =>
    setDraft({
      id: r.id, name: r.name, url: r.url, makes: String(r.makes), notes: r.notes,
      rows: r.ingredients.map((g) => newRow({ itemId: g.itemId, servings: String(g.servings) })),
    })

  return (
    <>
      <header className="top">
        <div className="top-title">
          <h1>Recipes</h1>
          <p className="muted">Ingredients are counted in servings</p>
        </div>
      </header>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add recipe</button>
      </div>

      {recipes.length === 0 ? (
        <div className="empty card"><p>Paste a link from a recipe site or type one in.</p></div>
      ) : (
        <div className="card list">
          {[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
            <button key={r.id} className="recipe-row" onClick={() => open(r)}>
              <span className="shop-name">{r.name}</span>
              <span className="muted">
                Makes {fmt(r.makes)} · {r.ingredients.map((g) => items.find((i) => i.id === g.itemId)?.name).filter(Boolean).join(', ') || 'no ingredients'}
              </span>
            </button>
          ))}
        </div>
      )}

      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onReady={(d) => { setAdding(false); setDraft(d) }}
        />
      )}
      {draft && <EditSheet draft={draft} onClose={() => setDraft(null)} />}
    </>
  )
}

function AddSheet({ onClose, onReady }: { onClose: () => void; onReady: (d: Draft) => void }) {
  const items = useStore((s) => s.items)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const importLink = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/import?url=${encodeURIComponent(url.trim())}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error ?? 'Link import only works on the hosted app.')
      onReady({
        name: data.name ?? '',
        url: url.trim(),
        makes: String(data.makes ?? 1),
        rows: (data.ingredients as string[]).map((text) => newRow({ text, itemId: guessItem(text, items) })),
      })
    } catch (e) {
      setError(
        e instanceof TypeError || !(e instanceof Error)
          ? "Couldn't reach the import service. Link import works once the app is hosted — type it in for now."
          : e.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Add recipe" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (url.trim()) importLink() }}>
        <label>
          Paste a recipe link
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus />
        </label>
        {error && <p className="warn-text">{error}</p>}
        <button className="btn primary" disabled={!url.trim() || busy}>{busy ? 'Reading the page…' : 'Import'}</button>
      </form>
      <div className="or"><span>or</span></div>
      <button className="btn ghost full" onClick={() => onReady({ name: '', makes: '1', rows: [newRow()] })}>
        Type it in
      </button>
    </Sheet>
  )
}

function EditSheet({ draft: initial, onClose }: { draft: Draft; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const { saveRecipe, deleteRecipe, saveItem } = useStore.getState()
  const [d, setD] = useState(initial)
  const [newItemFor, setNewItemFor] = useState<Row | null>(null)

  const setRow = (key: string, patch: Partial<Row>) =>
    setD((x) => ({ ...x, rows: x.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }))
  const makes = Number(d.makes)
  const valid = d.name.trim() !== '' && makes > 0
  const rawItems = items.filter((i) => !i.batchOf).sort((a, b) => a.name.localeCompare(b.name))

  const save = () => {
    if (!valid) return
    saveRecipe({
      id: d.id,
      name: d.name.trim(),
      url: d.url,
      notes: d.notes,
      makes,
      ingredients: d.rows
        .filter((r) => r.itemId && Number(r.servings) > 0)
        .map((r) => ({ itemId: r.itemId, servings: Number(r.servings) })),
    })
    onClose()
  }

  if (newItemFor) {
    return (
      <Sheet title="New pantry item" onClose={() => setNewItemFor(null)}>
        {newItemFor.text && <p className="muted">From the recipe: “{newItemFor.text}”</p>}
        <ItemForm
          initial={{ stock: 0 }}
          submitLabel="Add item"
          onCancel={() => setNewItemFor(null)}
          onSubmit={(draft) => {
            const id = saveItem(draft)
            setRow(newItemFor.key, { itemId: id })
            setNewItemFor(null)
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet title={d.id ? 'Edit recipe' : 'New recipe'} onClose={onClose}>
      <div className="form">
        <label>
          Name
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Spaghetti & meatballs" />
        </label>
        <label>
          Makes how many meals?
          <input inputMode="decimal" value={d.makes} onChange={(e) => setD({ ...d, makes: e.target.value })} />
        </label>
        {d.url && (
          <a className="link" href={d.url} target="_blank" rel="noreferrer">Open original recipe ↗</a>
        )}

        <p className="group-label">Ingredients (servings for the whole recipe)</p>
        <p className="hint">Skip things you always have, like salt and oil — leave them as “Not tracked”.</p>
        {d.rows.map((r) => (
          <div key={r.key} className="ing-row card inset">
            {r.text && <p className="ing-text">{r.text}</p>}
            <div className="ing-controls">
              <select
                value={r.itemId}
                onChange={(e) => (e.target.value === '__new' ? setNewItemFor(r) : setRow(r.key, { itemId: e.target.value }))}
              >
                <option value="">Not tracked</option>
                {rawItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                <option value="__new">+ New pantry item…</option>
              </select>
              <input
                className="num"
                inputMode="decimal"
                aria-label="Servings"
                value={r.servings}
                onChange={(e) => setRow(r.key, { servings: e.target.value })}
                disabled={!r.itemId}
              />
              <button
                className="icon-btn"
                aria-label="Remove ingredient"
                onClick={() => setD({ ...d, rows: d.rows.filter((x) => x.key !== r.key) })}
              >✕</button>
            </div>
          </div>
        ))}
        <button className="btn ghost" onClick={() => setD({ ...d, rows: [...d.rows, newRow()] })}>+ Ingredient</button>

        <div className="actions">
          {d.id && (
            <DeleteButton label="Delete" onConfirm={() => { deleteRecipe(d.id!); onClose() }} />
          )}
          <button className="btn primary" disabled={!valid} onClick={save}>Save recipe</button>
        </div>
      </div>
    </Sheet>
  )
}
