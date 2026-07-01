import type { TriageStatus } from '../../lib/triage-config'

interface StatusCardProps {
  status: TriageStatus
  hasNeeds: boolean
  notAccepts?: string[]
}

const LEVEL_LABEL: Record<TriageStatus['level'], string> = {
  critical: '🔴 Nivel crítico',
  high: '🟡 Atención requerida',
  ok: '🟢 Operando bien',
  empty: '⚪ Sin datos',
}

export function StatusCard({ status, hasNeeds, notAccepts }: StatusCardProps) {
  return (
    <div className={`triage-status triage-status--${status.level}`}>
      <p className="triage-status__level">{LEVEL_LABEL[status.level]}</p>
      <div className="triage-status__row">
        {hasNeeds && <span className="triage-status__pct">{status.pct}%</span>}
        <h2 className="triage-status__headline">{status.headline}</h2>
      </div>
      <p className="triage-status__detail">{status.detail}</p>
      {notAccepts && notAccepts.length > 0 && (
        <p className="triage-status__not-accepts">
          🚫 No aceptamos: {notAccepts.join(', ')}
        </p>
      )}
    </div>
  )
}
