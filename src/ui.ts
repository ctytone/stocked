import { create } from 'zustand'

export type Tab = 'week' | 'recipes' | 'pantry' | 'shop' | 'account'
/** Something a screen should open as soon as it appears (e.g. from the getting-started checklist). */
export type Intent = 'quick-add' | 'add-recipe' | null

const ONBOARD_KEY = 'stocked-onboarding'
const read = (): { dismissed?: boolean; shopped?: boolean } => {
  try { return JSON.parse(localStorage.getItem(ONBOARD_KEY) ?? '{}') } catch { return {} }
}
const write = (v: object) => { try { localStorage.setItem(ONBOARD_KEY, JSON.stringify(v)) } catch { /* ignore */ } }

interface UiState {
  tab: Tab
  intent: Intent
  onboarding: { dismissed?: boolean; shopped?: boolean }
  go: (tab: Tab, intent?: Intent) => void
  clearIntent: () => void
  dismissOnboarding: () => void
}

export const useUi = create<UiState>((set, get) => ({
  tab: 'week',
  intent: null,
  onboarding: read(),
  go: (tab, intent = null) => {
    if (tab === 'shop' && !get().onboarding.shopped) {
      const onboarding = { ...get().onboarding, shopped: true }
      write(onboarding)
      set({ onboarding })
    }
    set({ tab, intent })
  },
  clearIntent: () => set({ intent: null }),
  dismissOnboarding: () => {
    const onboarding = { ...get().onboarding, dismissed: true }
    write(onboarding)
    set({ onboarding })
  },
}))
