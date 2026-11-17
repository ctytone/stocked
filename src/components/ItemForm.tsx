import { useState } from 'react'
import type { Item, Location } from '../lib/types'
import { LOCATIONS } from '../lib/types'

export type ItemDraft = Omit<Item, 'id'> & { id?: string }

/** Name, where it lives, servings per package, and (optionally) servings on hand. */
export function ItemForm({
  initial,
  showStock = true,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ItemDraft>
  showStock?: boolean
  submitLabel?: string
  onSubmit: (item: ItemDraft) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [location, setLocation] = useState<Location>(initial?.location ?? 'fridge')
  const [spp, setSpp] = useState(String(initial?.servingsPerPackage ?? ''))
  const [stock, setStock] = useState(String(initial?.stock ?? 0))

  const sppNum = Number(spp)
  const valid = name.trim() !== '' && sppNum > 0

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({
          ...initial,
          name: name.trim(),
          location,
          servingsPerPackage: sppNum,
          stock: Math.max(0, Number(stock) || 0),
        })
      }}
    >
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Greek yogurt (tub)" autoFocus />
      </label>
      <div className="row2">
        <label>
          Servings per package
          <input inputMode="decimal" value={spp} onChange={(e) => setSpp(e.target.value)} placeholder="8" />
        </label>
        {showStock && (
          <label>
            Servings on hand
            <input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
        )}
      </div>
      <div className="seg" role="radiogroup" aria-label="Where it's kept">
        {LOCATIONS.map((l) => (
          <button type="button" key={l} className={l === location ? 'on' : ''} onClick={() => setLocation(l)}>
            {l[0].toUpperCase() + l.slice(1)}
          </button>
        ))}
      </div>
      <div className="actions">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn primary" disabled={!valid}>{submitLabel}</button>
      </div>
    </form>
  )
}
