import { useEffect, useState } from 'react'
import { useStore } from './store'
import { refresh, useCloudSync, useSync } from './sync'
import { WeekScreen } from './screens/WeekScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { PantryScreen } from './screens/PantryScreen'
import { ShopScreen } from './screens/ShopScreen'
import { AccountScreen } from './screens/AccountScreen'

type Tab = 'week' | 'recipes' | 'pantry' | 'shop' | 'account'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'week', label: 'Week', icon: '▦' },
  { id: 'recipes', label: 'Recipes', icon: '☰' },
  { id: 'pantry', label: 'Pantry', icon: '◫' },
  { id: 'shop', label: 'Shop', icon: '✓' },
  { id: 'account', label: 'Account', icon: '◯' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('week')
  const tick = useStore((s) => s.tick)
  useCloudSync()
  const recovering = useSync((s) => s.recovering)
  useEffect(() => { if (recovering) setTab('account') }, [recovering])

  // On open and whenever the app comes back on screen: get the latest from the cloud (if signed in),
  // then mark yesterday's planned meals as eaten. A timer catches midnight while the app stays open.
  useEffect(() => {
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(tick, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [tick])

  return (
    <div className="app">
      <main className="screen">
        {tab === 'week' && <WeekScreen />}
        {tab === 'recipes' && <RecipesScreen />}
        {tab === 'pantry' && <PantryScreen />}
        {tab === 'shop' && <ShopScreen />}
        {tab === 'account' && <AccountScreen />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
