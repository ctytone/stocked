import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Item, Recipe } from '../lib/types'
import { fmt } from '../lib/planner'
import { guessItem, guessLocation, ingredientName, isStaple } from '../lib/ingredients'
import { useUi } from '../ui'
import { Sheet } from '../components/Sheet'
import { DeleteButton } from '../components/DeleteButton'
import { Icon } from '../components/Icon'

/** itemId: '' = not tracked, NEW = create a pantry item called `newName` on save, otherwise an existing item. */
const NEW = '__new'

interface Row {
  key: string
  /** The ingredient as written ("1 lb ground beef") */
  text: string
  itemId: string
  newName: string
  servings: string
}

interface Draft {
  id?: string
  name: string
  url?: string
  makes: string
  notes?: string
  steps: string
  rows: Row[]
}

let rowKey = 0
const newRow = (r: Partial<Row> = {}): Row => ({ key: `r${rowKey++}`, text: '', itemId: '', newName: '', servings: '1', ...r })

/**
 * Turn recipe lines into rows: match what's already in the pantry, leave staples (salt, oil) untracked,
 * and propose a new pantry item for everything else. Each tracked line defaults to 1 serving per meal.
 */
function rowsFrom(lines: string[], items: Item[], makes: number): Row[] {
  const servings = String(makes > 0 ? makes : 1)
  return lines.map((text) => {
    const match = guessItem(text, items)
    if (match) return newRow({ text, itemId: match, servings })
    if (isStaple(text) || /:\s*$/.test(text)) return newRow({ text })
    return newRow({ text, itemId: NEW, newName: ingredientName(text), servings })
  })
}

export function RecipesScreen() {
  const recipes = useStore((s) => s.recipes)
  const items = useStore((s) => s.items)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [adding, setAdding] = useState(() => useUi.getState().intent === 'add-recipe')
  useEffect(() => { useUi.getState().clearIntent() }, [])

  const open = (r: Recipe) =>
    setDraft({
      id: r.id, name: r.name, url: r.url, makes: String(r.makes), notes: r.notes,
      steps: (r.steps ?? []).join('\n'),
      rows: r.ingredients.map((g) => newRow({ text: g.text ?? '', itemId: g.itemId ?? '', servings: String(g.servings) })),
    })

  return (
    <>
      <header className="top">
        <div className="top-title">
          <h1>Recipes</h1>
          <p className="muted">{recipes.length ? `${recipes.length} saved` : 'Import from a link or type one in'}</p>
        </div>
      </header>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add recipe</button>
      </div>

      {recipes.length === 0 ? (
        <div className="empty surface">
          <p>
            <strong>No recipes yet.</strong> Paste a link from a recipe site and Stocked reads the ingredients and steps for
            you. Anything you don't have yet is added to your pantry so it shows up on your shopping list.
          </p>
        </div>
      ) : (
        <div className="surface list">
          {[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
            <button key={r.id} className="recipe-row" onClick={() => open(r)}>
              <span className="shop-name">{r.name}</span>
              <span className="muted">
                Makes {fmt(r.makes)} ·{' '}
                {r.ingredients
                  .map((g) => items.find((i) => i.id === g.itemId)?.name ?? (g.text ? ingredientName(g.text) : ''))
                  .filter(Boolean)
                  .join(', ') || 'no ingredients'}
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
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  /** Turn a pasted ingredient list (one per line, bullets and checkboxes allowed) into rows. */
  const fromPaste = () => {
    const lines = pasted
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s•\-*▢☐□✓]+/, '').trim())
      .filter((l) => l.length > 1 && !/^ingredients:?$/i.test(l))
    onReady({
      name: '',
      url: url.trim() || undefined,
      makes: '1',
      steps: '',
      rows: lines.length ? rowsFrom(lines, items, 1) : [newRow()],
    })
  }

  if (pasting) {
    return (
      <Sheet title="Paste ingredients" onClose={onClose}>
        <div className="form">
          <p className="muted">Copy the ingredient list from the recipe page and paste it here, one ingredient per line.</p>
          <textarea
            className="paste"
            rows={8}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'1 lb ground beef\n1 jar marinara\n8 oz spaghetti'}
            aria-label="Ingredient list"
            autoFocus
          />
          <div className="actions">
            <button className="btn ghost" onClick={() => setPasting(false)}>Back</button>
            <button className="btn primary" disabled={!pasted.trim()} onClick={fromPaste}>Next</button>
          </div>
        </div>
      </Sheet>
    )
  }

  const importLink = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/import?url=${encodeURIComponent(url.trim())}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error ?? 'Link import only works on the hosted app.')
      const makes = Number(data.makes) > 0 ? Number(data.makes) : 1
      onReady({
        name: data.name ?? '',
        url: url.trim(),
        makes: String(makes),
        steps: ((data.steps ?? []) as string[]).join('\n'),
        rows: rowsFrom(data.ingredients as string[], items, makes),
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
        {error && (
          <p className="warn-text">
            {error}{' '}
            <button type="button" className="text-btn" onClick={() => setPasting(true)}>Paste the ingredients instead</button>
          </p>
        )}
        <button className="btn primary" disabled={!url.trim() || busy}>{busy ? 'Reading the page…' : 'Import'}</button>
      </form>
      <div className="or"><span>or</span></div>
      <button className="btn ghost full" onClick={() => setPasting(true)}>Paste the ingredient list</button>
      <button className="btn ghost full" onClick={() => onReady({ name: '', makes: '1', steps: '', rows: [newRow()] })}>
        Type it in
      </button>
    </Sheet>
  )
}

function EditSheet({ draft: initial, onClose }: { draft: Draft; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const { saveRecipe, deleteRecipe, saveItem } = useStore.getState()
  const [d, setD] = useState(initial)

  const setRow = (key: string, patch: Partial<Row>) =>
    setD((x) => ({ ...x, rows: x.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }))
  const makes = Number(d.makes)
  const valid = d.name.trim() !== '' && makes > 0
  const rawItems = items.filter((i) => !i.batchOf).sort((a, b) => a.name.localeCompare(b.name))
  const creating = d.rows.filter((r) => r.itemId === NEW && r.newName.trim())

  const save = () => {
    if (!valid) return
    // Create the new pantry items first (one per name, reusing an existing item with the same name).
    const made = new Map<string, string>()
    const idFor = (r: Row): string | undefined => {
      if (r.itemId !== NEW) return r.itemId || undefined
      const name = r.newName.trim()
      if (!name) return undefined
      const k = name.toLowerCase()
      const existing = made.get(k) ?? items.find((i) => !i.batchOf && i.name.toLowerCase() === k)?.id
      if (existing) { made.set(k, existing); return existing }
      const servings = Number(r.servings) > 0 ? Number(r.servings) : 1
      const id = saveItem({ name, location: guessLocation(name), servingsPerPackage: servings, stock: 0, needsReview: true })
      made.set(k, id)
      return id
    }
    saveRecipe({
      id: d.id,
      name: d.name.trim(),
      url: d.url,
      notes: d.notes?.trim() || undefined,
      makes,
      steps: d.steps.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      ingredients: d.rows
        .map((r) => ({ itemId: idFor(r), servings: Number(r.servings) > 0 ? Number(r.servings) : 1, text: r.text.trim() || undefined }))
        .filter((g) => g.itemId || g.text),
    })
    onClose()
  }

  return (
    <Sheet title={d.id ? 'Edit recipe' : 'New recipe'} onClose={onClose}>
      <div className="form">
        <label>
          Name
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Buffalo chicken dip" />
        </label>
        <label>
          Makes how many meals?
          <input inputMode="decimal" value={d.makes} onChange={(e) => setD({ ...d, makes: e.target.value })} />
        </label>
        {d.url && (
          <a className="link" href={d.url} target="_blank" rel="noreferrer">
            Open original recipe <Icon name="link" size={16} />
          </a>
        )}

        <p className="group-label">Ingredients</p>
        <p className="hint">
          Tracked ingredients come out of your pantry when you eat this. The number is servings for the whole recipe.
          Staples like salt and oil start as “Not tracked”.
        </p>
        {creating.length > 0 && (
          <p className="notice">
            {creating.length} new pantry item{creating.length > 1 ? 's' : ''} will be added with nothing on hand, so{' '}
            {creating.length > 1 ? 'they land' : 'it lands'} on your shopping list. You can fix package sizes in Pantry later.
          </p>
        )}
        {d.rows.map((r) => (
          <div key={r.key} className="ing-row well">
            <input
              className="ing-text"
              value={r.text}
              onChange={(e) => setRow(r.key, { text: e.target.value })}
              placeholder="e.g. 1 lb ground beef"
              aria-label="Ingredient as written"
            />
            <div className="ing-controls">
              <select
                value={r.itemId}
                aria-label="Pantry item"
                onChange={(e) =>
                  setRow(
                    r.key,
                    e.target.value === NEW
                      ? { itemId: NEW, newName: r.newName || (r.text ? ingredientName(r.text) : '') }
                      : { itemId: e.target.value },
                  )
                }
              >
                <option value="">Not tracked</option>
                <option value={NEW}>+ New pantry item</option>
                {rawItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input
                className="num"
                inputMode="decimal"
                aria-label="Servings for the whole recipe"
                value={r.servings}
                onChange={(e) => setRow(r.key, { servings: e.target.value })}
                disabled={!r.itemId}
              />
              <button
                className="icon-btn"
                aria-label="Remove ingredient"
                onClick={() => setD({ ...d, rows: d.rows.filter((x) => x.key !== r.key) })}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {r.itemId === NEW && (
              <div className="new-item">
                <span className="chip info">New</span>
                <input
                  value={r.newName}
                  onChange={(e) => setRow(r.key, { newName: e.target.value })}
                  aria-label="New pantry item name"
                  placeholder="Pantry item name"
                />
              </div>
            )}
          </div>
        ))}
        <button className="btn ghost" onClick={() => setD({ ...d, rows: [...d.rows, newRow()] })}>+ Ingredient</button>

        <label>
          Steps (one per line)
          <textarea
            className="paste"
            rows={5}
            value={d.steps}
            onChange={(e) => setD({ ...d, steps: e.target.value })}
            placeholder={'Preheat the oven to 350°F.\nMix everything in a baking dish.\nBake 20 minutes.'}
          />
        </label>
        <label>
          Notes
          <textarea className="paste" rows={2} value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </label>

        <div className="actions">
          {d.id && <DeleteButton label="Delete" onConfirm={() => { deleteRecipe(d.id!); onClose() }} />}
          <button className="btn primary" disabled={!valid} onClick={save}>Save recipe</button>
        </div>
      </div>
    </Sheet>
  )
}
