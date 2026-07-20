import { useState } from 'react'
import { useSupportRequests, useCreateSupportRequest } from '@/hooks/useCenterOperations'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn, timeAgo } from '@/lib/utils'
import { SUPPORT_REQUEST_TYPE_LABELS } from '@/domain/center-operations.types'

const URGENCY_TONES: Record<string, string> = {
  low: 'bg-white/10 text-ink-subtle',
  medium: 'bg-info/20 text-info',
  high: 'bg-warning/20 text-warning',
  critical: 'bg-critical/20 text-critical',
}

const URGENCY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

const STATUS_TONES: Record<string, string> = {
  open: 'bg-info/20 text-info',
  in_progress: 'bg-warning/20 text-warning',
  fulfilled: 'bg-operational/20 text-operational',
  cancelled: 'bg-white/10 text-ink-faint',
}

function NewRequestForm({ centerId, onClose }: { centerId: string; onClose: () => void }) {
  const [requestType, setRequestType] = useState('supplies')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [quantity, setQuantity] = useState(1)
  const create = useCreateSupportRequest(centerId)

  const handleSubmit = async () => {
    await create.mutateAsync({
      requestType,
      title,
      description,
      urgency,
      quantity,
    })
    onClose()
  }

  return (
    <div className="space-y-3 p-4">
      <h4 className="text-sm font-semibold text-ink">Nueva solicitud de apoyo</h4>

      <div>
        <label className="block text-xs text-ink-subtle mb-1">Tipo</label>
        <select
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
        >
          {Object.entries(SUPPORT_REQUEST_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-ink-subtle mb-1">Título</label>
        <input
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          placeholder="¿Qué necesitas?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs text-ink-subtle mb-1">Descripción</label>
        <textarea
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint resize-none"
          rows={3}
          placeholder="Detalles de la solicitud..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-ink-subtle mb-1">Urgencia</label>
          <select
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          >
            {Object.entries(URGENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-subtle mb-1">Cantidad</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <EmergencyButton
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={create.isPending || !title.trim() || !description.trim()}
        >
          {create.isPending ? 'Creando...' : 'Crear solicitud'}
        </EmergencyButton>
        <EmergencyButton variant="glass" size="sm" onClick={onClose}>
          Cancelar
        </EmergencyButton>
      </div>

      {create.isError && (
        <p className="text-xs text-critical">{(create.error as Error).message}</p>
      )}
    </div>
  )
}

export function CoordinatorSupportPanel() {
  const { assignment } = useCoordinatorAssignment()
  const { data: requests, isLoading } = useSupportRequests(assignment?.siteId ?? '')
  const [showForm, setShowForm] = useState(false)

  if (!assignment) {
    return (
      <div className="p-4 text-center text-sm text-ink-muted">
        No tienes un centro asignado
      </div>
    )
  }

  if (showForm) {
    return (
      <NewRequestForm centerId={assignment.siteId} onClose={() => setShowForm(false)} />
    )
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink">Solicitudes de apoyo</h3>
        <EmergencyButton
          variant="primary"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          Nueva solicitud
        </EmergencyButton>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <GlassCard key={i} className="h-20 animate-pulse" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-ink-subtle">No hay solicitudes de apoyo</p>
        </GlassCard>
      ) : (
        requests.map((req) => (
          <GlassCard key={req.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-ink truncate">{req.title}</h4>
                <p className="text-xs text-ink-subtle mt-0.5">
                  {SUPPORT_REQUEST_TYPE_LABELS[req.requestType] ?? req.requestType}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', URGENCY_TONES[req.urgency])}>
                  {URGENCY_LABELS[req.urgency] ?? req.urgency}
                </span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs', STATUS_TONES[req.status])}>
                  {req.status === 'open' ? 'Abierta' : req.status === 'in_progress' ? 'En progreso' : req.status === 'fulfilled' ? 'Cumplida' : 'Cancelada'}
                </span>
              </div>
            </div>
            {req.description && (
              <p className="text-xs text-ink-muted line-clamp-2 mb-2">{req.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-ink-faint">
              <span>Cantidad: {req.quantity}</span>
              <span>{timeAgo(req.createdAt)}</span>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  )
}
