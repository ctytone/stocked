import { beforeEach, describe, expect, it, vi } from 'vitest'

// A tiny in-memory stand-in for the Supabase table.
const table = new Map<string, { data: unknown; updated_at: string }>()
const upserts: unknown[] = []
vi.mock('./lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: async (row: { user_id: string; data: unknown; updated_at: string }) => {
        upserts.push(row)
        table.set(row.user_id, { data: row.data, updated_at: row.updated_at })
        return { error: null }
      },
      select: () => ({
        eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: table.get(id) ?? null, error: null }) }),
      }),
    }),
    auth: { signOut: async () => ({ error: null }) },
  },
}))
vi.stubGlobal('window', globalThis)
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const { useStore } = await import('./store')
const { refresh, signOut, useSync } = await import('./sync')

const session = { user: { id: 'u1', email: 'a@b.c' } } as never
const item = (id: string) => ({ id, name: id, location: 'fridge' as const, servingsPerPackage: 8, stock: 8 })

beforeEach(() => {
  table.clear()
  upserts.length = 0
  useStore.getState().replaceData({ items: [], recipes: [], meals: [], purchases: [] })
})

describe('cloud sync', () => {
  it('a brand-new account uploads what is already on the device', async () => {
    useStore.getState().replaceData({ items: [item('yogurt')], recipes: [], meals: [], purchases: [] })
    useSync.setState({ session })
    await refresh()
    expect(upserts).toHaveLength(1)
    expect((table.get('u1')!.data as { items: unknown[] }).items).toHaveLength(1)
    expect(useSync.getState().status).toBe('saved')
  })

  it('an existing cloud plan replaces the device copy', async () => {
    table.set('u1', { data: { items: [item('cloud')], recipes: [], meals: [], purchases: [] }, updated_at: '2026-11-16T00:00:00Z' })
    useStore.getState().replaceData({ items: [item('device')], recipes: [], meals: [], purchases: [] })
    useSync.setState({ session })
    await refresh()
    expect(useStore.getState().items.map((i) => i.id)).toEqual(['cloud'])
    expect(upserts).toHaveLength(0)
  })

  it('signing out clears the device', async () => {
    useStore.getState().replaceData({ items: [item('x')], recipes: [], meals: [], purchases: [] })
    await signOut()
    expect(useStore.getState().items).toHaveLength(0)
  })
})
