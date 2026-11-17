import { useState } from 'react'

/** Tap once to arm, tap again to delete. Avoids browser confirm() popups, which some app views block. */
export function DeleteButton({ label, onConfirm, full }: { label: string; onConfirm: () => void; full?: boolean }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      className={`btn ghost danger${full ? ' full' : ''}${armed ? ' armed' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Tap again to delete' : label}
    </button>
  )
}
