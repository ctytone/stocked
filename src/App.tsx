import { useEffect } from 'react'
import { useStore } from './store'
import { refresh, useCloudSync, useSync } from './sync'
import { WeekScreen } from './screens/WeekScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { PantryScreen } from './screens/PantryScreen'
import { ShopScreen } from './screens/ShopScreen'
import { AccountScreen } from './screens/AccountScreen'
import { useUi, type Tab } from './ui'
import { Icon } from './components/Icon'

const TABS: { id: Tab; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'shop', label: 'Shop' },
  { id: 'account', label: 'Account' },
]

export default function App() {
  const tab = useUi((s) => s.tab)
  const setTab = useUi((s) => s.go)
  const tick = useStore((s) => s.tick)
  useCloudSync()
  const recovering = useSync((s) => s.recovering)
  useEffect(() => { if (recovering) setTab('account') }, [recovering, setTab])

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
    <div className={`app${tab === 'week' ? ' wide' : ''}`}>
      <main className="screen">
        {tab === 'week' && <WeekScreen />}
        {tab === 'recipes' && <RecipesScreen />}
        {tab === 'pantry' && <PantryScreen />}
        {tab === 'shop' && <ShopScreen />}
        {tab === 'account' && <AccountScreen />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon"><Icon name={t.id} /></span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
