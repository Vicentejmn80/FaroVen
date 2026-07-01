import { useEffect, useRef, useState } from 'react'
import {
  useCoordinatorPendingReports,
  useCoordinatorReportCount,
} from '@/hooks/useCoordinatorReports'
import { REPORT_TYPE_LABELS } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

interface CoordinatorNotificationsProps {
  onViewAll: () => void
}

export function CoordinatorNotifications({ onViewAll }: CoordinatorNotificationsProps) {
  const { data: count = 0 } = useCoordinatorReportCount()
  const { data: reports } = useCoordinatorPendingReports()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const latest = reports?.slice(0, 3) ?? []

  const goToInbox = () => {
    setOpen(false)
    onViewAll()
  }

  return (
    <div className="pv3-notif" ref={rootRef}>
      <button
        type="button"
        className="pv3-notif__bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Reportes pendientes (${count})`}
        aria-expanded={open}
      >
        🔔
        {count > 0 && (
          <span className="pv3-notif__badge">{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <div className="pv3-notif__dropdown">
          <p className="pv3-notif__title">Reportes de tu sitio</p>
          {latest.length === 0 ? (
            <p className="pv3-notif__empty">No hay reportes pendientes</p>
          ) : (
            <ul className="pv3-notif__list">
              {latest.map((r) => (
                <li key={r.id}>
                  <button type="button" className="pv3-notif__item" onClick={goToInbox}>
                    <span className="pv3-notif__item-type">{REPORT_TYPE_LABELS[r.type]}</span>
                    <span className="pv3-notif__item-meta">{timeAgo(r.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="pv3-notif__all" onClick={goToInbox}>
            Ver todos
          </button>
        </div>
      )}
    </div>
  )
}
