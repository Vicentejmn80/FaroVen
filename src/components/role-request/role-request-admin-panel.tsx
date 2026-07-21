import { useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useRoleRequests } from '@/hooks/useRoleRequests'
import { useApproveRoleRequest, useRejectRoleRequest, useReviewRoleRequest } from '@/hooks/useRoleRequestMutations'
import { ROLE_REQUEST_STATUS_LABELS } from '@/lib/roles'
import type { RoleRequestStatus } from '@/lib/roles'
import { ROLE_REQUEST_TONES } from '@/domain/role-request.types'
import { cn } from '@/lib/utils'

export function RoleRequestAdminPanel() {
  const { data: requests, isLoading } = useRoleRequests()
  const approve = useApproveRoleRequest()
  const reject = useRejectRoleRequest()
  const review = useReviewRoleRequest()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [filter, setFilter] = useState<string>('pending')

  if (isLoading) return <GlassCard className="p-4 text-sm text-ink-subtle">Cargando solicitudes...</GlassCard>

  const pending = requests?.filter((r) => r.status === 'pending' || r.status === 'under_review') ?? []
  const history = requests?.filter((r) => r.status === 'approved' || r.status === 'rejected') ?? []
  const visible = filter === 'pending' ? pending : history

  const handleApprove = async (id: string) => {
    await approve.mutateAsync({ requestId: id, reviewNotes: reviewNotes || undefined })
    setSelectedId(null)
    setReviewNotes('')
  }

  const handleReject = async (id: string) => {
    await reject.mutateAsync({ requestId: id, reviewNotes: reviewNotes || undefined })
    setSelectedId(null)
    setReviewNotes('')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending')}
          className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', filter === 'pending' ? 'bg-info/20 text-info' : 'text-ink-subtle border border-white/10')}
        >
          Pendientes ({pending.length})
        </button>
        <button
          onClick={() => setFilter('history')}
          className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', filter === 'history' ? 'bg-info/20 text-info' : 'text-ink-subtle border border-white/10')}
        >
          Historial ({history.length})
        </button>
      </div>

      {visible.length === 0 && (
        <GlassCard className="p-4 text-center text-sm text-ink-subtle">
          {filter === 'pending' ? 'No hay solicitudes pendientes' : 'No hay solicitudes en el historial'}
        </GlassCard>
      )}

      <div className="grid gap-3">
        {visible.map((req) => (
          <GlassCard key={req.id} className={cn('p-3', selectedId === req.id ? 'ring-1 ring-info/40' : '')} onClick={() => setSelectedId(req.id === selectedId ? null : req.id)}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-ink">{req.fullName}</p>
                <p className="text-xs text-ink-subtle">{req.email}</p>
              </div>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ROLE_REQUEST_TONES[req.status as RoleRequestStatus])}>
                {ROLE_REQUEST_STATUS_LABELS[req.status as RoleRequestStatus]}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span>Rol: {req.requestedRole === 'case_manager' ? 'Gestor de Casos' : 'Coordinador'}</span>
              {req.organization && <span>Org: {req.organization}</span>}
              {req.availabilityHours && <span>{req.availabilityHours}h/sem</span>}
            </div>
            {req.reason && <p className="mt-1 text-xs text-ink-subtle line-clamp-2">{req.reason}</p>}

            {selectedId === req.id && (
              <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                {req.experience && (
                  <div>
                    <p className="text-xs font-medium text-ink-subtle">Experiencia</p>
                    <p className="text-xs text-ink-muted">{req.experience}</p>
                  </div>
                )}
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink-subtle">Notas de revisión</span>
                  <textarea
                    value={selectedId === req.id ? reviewNotes : ''}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
                  />
                </label>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <EmergencyButton variant="glass" size="sm" onClick={() => review.mutate(req.id)} disabled={review.isPending}>Revisar</EmergencyButton>
                  </div>
                )}
                {(req.status === 'pending' || req.status === 'under_review') && (
                  <div className="flex gap-2">
                    <EmergencyButton variant="primary" size="sm" onClick={() => handleApprove(req.id)} disabled={approve.isPending}>Aprobar</EmergencyButton>
                    <EmergencyButton variant="glass" size="sm" onClick={() => handleReject(req.id)} disabled={reject.isPending}>Rechazar</EmergencyButton>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
