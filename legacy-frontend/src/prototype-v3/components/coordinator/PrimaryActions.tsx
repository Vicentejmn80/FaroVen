import type { TriageAction } from '../../lib/triage-config'

interface PrimaryActionsProps {
  actions: TriageAction[]
  onAction: (id: TriageAction['id']) => void
}

export function PrimaryActions({ actions, onAction }: PrimaryActionsProps) {
  return (
    <div className="triage-actions">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className="triage-action-btn"
          onClick={() => onAction(a.id)}
        >
          <span className="triage-action-icon">{a.icon}</span>
          <span className="triage-action-label">{a.label}</span>
          <span className="triage-action-desc">{a.desc}</span>
        </button>
      ))}
    </div>
  )
}
