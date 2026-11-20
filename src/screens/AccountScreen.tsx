import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { signOut, useSync, type SyncStatus } from '../sync'

const STATUS: Record<SyncStatus, string> = {
  local: 'Saved on this device only',
  loading: 'Loading your plan…',
  saving: 'Saving…',
  saved: 'Synced',
  offline: "Offline — changes will sync when you're back online",
  error: "Couldn't sync",
}

export function AccountScreen() {
  const { session, status, error, recovering } = useSync()

  return (
    <>
      <header className="top">
        <div className="top-title">
          <h1>Account</h1>
          <p className="muted">{STATUS[status]}</p>
        </div>
      </header>

      {!supabase ? (
        <div className="surface empty">
          <p>This copy of the app saves your plan in this browser only. Accounts turn on once the app is hosted with Supabase.</p>
        </div>
      ) : recovering && session ? (
        <NewPassword />
      ) : session ? (
        <div className="surface empty">
          <p>Signed in as <strong>{session.user.email}</strong>. Your plan syncs between your phone and computer.</p>
          {status === 'error' && <p className="warn-text">{error}</p>}
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </div>
      ) : (
        <SignIn />
      )}

      <h2 className="section-label">Put it on your home screen</h2>
      <div className="surface empty">
        <p><strong>iPhone:</strong> open this site in Safari → Share → <em>Add to Home Screen</em>.</p>
        <p><strong>Android:</strong> open it in Chrome → ⋮ menu → <em>Add to Home screen</em>.</p>
      </div>
    </>
  )
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  const submit = async () => {
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const redirect = window.location.origin
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
        if (error) throw error
        if (!data.session) setMsg({ text: 'Check your email to confirm your account, then sign in here.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })
        if (error) throw error
        setMsg({ text: 'If that email has an account, a reset link is on its way.' })
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Something went wrong.', bad: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface empty">
      <p>
        {mode === 'up'
          ? 'Create an account to sync your plan between your phone and computer. Anything already on this device gets saved to it.'
          : mode === 'reset'
            ? "Enter your email and we'll send a link to set a new password."
            : 'Sign in to sync your plan across devices. Without an account, it saves on this device only.'}
      </p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode !== 'reset' && (
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        )}
        {msg && <p className={msg.bad ? 'warn-text' : ''}>{msg.text}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'One sec…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
        </button>
      </form>
      <div className="link-row">
        {mode !== 'in' && <button className="text-btn" onClick={() => setMode('in')}>Sign in instead</button>}
        {mode !== 'up' && <button className="text-btn" onClick={() => setMode('up')}>Create an account</button>}
        {mode === 'in' && <button className="text-btn" onClick={() => setMode('reset')}>Forgot password?</button>}
      </div>
    </div>
  )
}

function NewPassword() {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  return (
    <div className="surface empty">
      <p>Choose a new password.</p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = (await supabase?.auth.updateUser({ password })) ?? {}
          if (error) setMsg({ text: error.message, bad: true })
          else {
            setMsg({ text: 'Password updated.' })
            useSync.setState({ recovering: false })
          }
        }}
      >
        <input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg && <p className={msg.bad ? 'warn-text' : ''}>{msg.text}</p>}
        <button className="btn primary">Save password</button>
      </form>
    </div>
  )
}
