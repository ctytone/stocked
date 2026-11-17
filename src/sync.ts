import { useEffect } from 'react'
import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { normalize, snapshot, useStore } from './store'

export type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'offline' | 'error'

interface SyncState {
  session: Session | null
  status: SyncStatus
  error?: string
  /** True after opening a password-reset email link: show the "new password" form. */
  recovering?: boolean
}

export const useSync = create<SyncState>(() => ({ session: null, status: 'local' }))

const TABLE = 'planner_state'
let applyingRemote = false
let dirty = false
let lastRemoteAt = ''
let saveTimer: number | undefined

const setStatus = (status: SyncStatus, error?: string) => useSync.setState({ status, error })

async function push(): Promise<void> {
  const session = useSync.getState().session
  if (!supabase || !session) return
  window.clearTimeout(saveTimer)
  setStatus('saving')
  const updated_at = new Date().toISOString()
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: session.user.id, data: snapshot(useStore.getState()), updated_at })
  if (error) {
    setStatus(navigator.onLine ? 'error' : 'offline', error.message)
    return
  }
  dirty = false
  lastRemoteAt = updated_at
  setStatus('saved')
}

/** Get the cloud copy. Cloud wins if it exists; a brand-new account gets this device's data. */
async function pull(): Promise<void> {
  const session = useSync.getState().session
  if (!supabase || !session) return
  if (dirty) return push() // don't overwrite edits that haven't been saved yet
  const { data, error } = await supabase.from(TABLE).select('data, updated_at').eq('user_id', session.user.id).maybeSingle()
  if (error) {
    setStatus(navigator.onLine ? 'error' : 'offline', error.message)
    return
  }
  if (!data) return push()
  if (data.updated_at !== lastRemoteAt) {
    applyingRemote = true
    useStore.getState().replaceData(normalize(data.data))
    applyingRemote = false
    lastRemoteAt = data.updated_at
  }
  setStatus('saved')
}

/** Pull from the cloud, then eat any planned meals from days that have ended. */
export async function refresh(): Promise<void> {
  await pull()
  useStore.getState().tick()
}

export async function signOut(): Promise<void> {
  if (dirty) await push()
  await supabase?.auth.signOut()
  // Signing out clears this device, so someone else using it can't see your plan.
  applyingRemote = true
  useStore.getState().replaceData(normalize({}))
  applyingRemote = false
  lastRemoteAt = ''
}

/** Keeps the planner in sync with Supabase while someone is signed in. Does nothing without keys. */
export function useCloudSync(): void {
  useEffect(() => {
    if (!supabase) return
    const onSession = (session: Session | null) => {
      const prev = useSync.getState().session
      useSync.setState({ session, status: session ? 'loading' : 'local', error: undefined })
      if (session && session.user.id !== prev?.user.id) refresh()
    }
    supabase.auth.getSession().then(({ data }) => onSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') useSync.setState({ recovering: true })
      onSession(session)
    })

    // Save a second after the last change.
    const unsubStore = useStore.subscribe((s, prev) => {
      if (applyingRemote || !useSync.getState().session) return
      if (s.items === prev.items && s.recipes === prev.recipes && s.meals === prev.meals && s.purchases === prev.purchases) return
      dirty = true
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(push, 1000)
    })

    // Coming back to the app is handled in App.tsx (refresh); leaving it saves right away.
    const onVisible = () => {
      if (document.visibilityState === 'hidden' && dirty) push()
    }
    const onOnline = () => (dirty ? push() : pull())
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      sub.subscription.unsubscribe()
      unsubStore()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}
