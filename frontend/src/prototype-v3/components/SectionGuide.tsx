import { useState } from 'react'

interface SectionGuideProps {
  id: string
  children: React.ReactNode
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** Dismissible blue info box; persists dismissal in localStorage. */
export function SectionGuide({ id, children }: SectionGuideProps) {
  const storageKey = `pv3-guide-dismissed-${id}`
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey))

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true)
  }

  return (
    <div className="pv3-note pv3-guide" role="note">
      <div className="pv3-guide__body">{children}</div>
      <button type="button" className="pv3-guide-dismiss" onClick={dismiss}>
        Entendido
      </button>
    </div>
  )
}
