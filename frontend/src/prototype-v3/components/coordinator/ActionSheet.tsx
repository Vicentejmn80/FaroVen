import { useEffect, type ReactNode } from 'react'

interface ActionSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function ActionSheet({ title, onClose, children }: ActionSheetProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="action-sheet-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="action-sheet">
        <div className="action-sheet-handle" />
        <div className="action-sheet-header">
          <h3 className="action-sheet-title">{title}</h3>
          <button
            type="button"
            className="action-sheet-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="action-sheet-body">
          {children}
        </div>
      </div>
    </div>
  )
}
