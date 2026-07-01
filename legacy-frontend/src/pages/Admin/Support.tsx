import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { useAdminSupportRequests, useUpdateSupportRequest } from '@/hooks/useAdmin'
import { formatDate } from '@/lib/utils'
import type { SupportRequest, SupportRequestStatus } from '@/lib/types'
import { SUPPORT_REQUEST_STATUS_LABELS } from '@/lib/types'

const STATUS_FILTERS: { value: SupportRequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'assigned', label: 'Asignados' },
  { value: 'contacted', label: 'Contactados' },
  { value: 'closed', label: 'Cerrados' },
]

const FOR_WHOM_LABELS: Record<SupportRequest['for_whom'], string> = {
  self: 'Para mí mismo/a',
  child: 'Para un niño/a',
  family: 'Para mi familia',
  other: 'Para otra persona',
}

const CONTACT_LABELS: Record<SupportRequest['contact_method'], string> = {
  whatsapp: 'WhatsApp',
  phone: 'Teléfono',
  none: 'Solo recursos, sin contacto',
}

function SupportRequestCard({
  req,
  onAction,
}: {
  req: SupportRequest
  onAction: (id: string, status: SupportRequestStatus, assigned_to: string, notes: string) => Promise<void>
}) {
  const [assignedTo, setAssignedTo] = useState(req.assigned_to ?? '')
  const [notes, setNotes] = useState(req.review_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [localStatus, setLocalStatus] = useState<SupportRequestStatus>(req.status)
  const [error, setError] = useState<string | null>(null)

  const act = async (status: SupportRequestStatus) => {
    setError(null)
    setBusy(true)
    try {
      await onAction(req.id, status, assignedTo, notes)
      setLocalStatus(status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setBusy(false)
    }
  }

  const isClosed = localStatus === 'closed'

  const urgentBadge = req.urgent ? (
    <Badge variant="danger" className="ml-2">Urgente</Badge>
  ) : null

  return (
    <Card className={req.urgent && localStatus === 'pending' ? 'border-destructive' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-1 flex-wrap">
              <CardTitle className="text-sm font-semibold">
                {FOR_WHOM_LABELS[req.for_whom]}
              </CardTitle>
              {urgentBadge}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(req.created_at)}</p>
          </div>
          <Badge variant={localStatus === 'pending' ? 'warning' : localStatus === 'closed' ? 'default' : 'success'}>
            {SUPPORT_REQUEST_STATUS_LABELS[localStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {req.topic && (
          <p className="text-sm">
            <span className="font-medium">Tema: </span>{req.topic}
          </p>
        )}
        {req.description && <p className="text-sm text-muted-foreground">{req.description}</p>}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Contacto preferido: {CONTACT_LABELS[req.contact_method]}</p>
          {req.contact_value && (
            <p>
              {req.contact_method === 'whatsapp' ? (
                <a
                  href={`https://wa.me/${req.contact_value.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {req.contact_value}
                </a>
              ) : (
                req.contact_value
              )}
            </p>
          )}
        </div>

        {!isClosed && (
          <>
            <div>
              <label className="label block mb-1">Asignar a (nombre o alias del psicólogo/a)</label>
              <Input
                placeholder="Ej. Dra. López · voluntaria"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              />
            </div>
            <textarea
              className="input text-sm"
              placeholder="Notas internas (no se muestran al solicitante)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: 72, resize: 'vertical' }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => act('assigned')} disabled={busy || !assignedTo.trim()}>
                Asignar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act('contacted')} disabled={busy}>
                Marcar contactado
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act('closed')} disabled={busy}>
                Cerrar
              </Button>
            </div>
          </>
        )}

        {isClosed && req.review_notes && (
          <p className="text-xs text-muted-foreground italic">Nota: {req.review_notes}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminSupportPage() {
  const [filter, setFilter] = useState<SupportRequestStatus | 'all'>('pending')
  const { data: requests, isLoading, error, refetch } = useAdminSupportRequests(
    filter === 'all' ? undefined : filter
  )
  const updateRequest = useUpdateSupportRequest()

  const handleAction = async (
    id: string,
    status: SupportRequestStatus,
    assigned_to: string,
    review_notes: string
  ) => {
    await updateRequest.mutateAsync({ id, status, assigned_to: assigned_to || undefined, review_notes })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold mb-1">Solicitudes de apoyo emocional</h1>
        <p className="text-sm text-muted-foreground">
          Cola confidencial. Asigna a un psicólogo/a voluntario/a y marca el seguimiento. Esta
          información es privada y no se muestra al público.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as SupportRequestStatus | 'all')}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage title="Error al cargar solicitudes" onRetry={refetch} />}

      {!isLoading && !error && (
        <>
          {!requests?.length ? (
            <p className="text-center text-muted-foreground py-10">No hay solicitudes en esta categoría.</p>
          ) : (
            <div className="space-y-4">
              {requests.map((r) => (
                <SupportRequestCard key={r.id} req={r} onAction={handleAction} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
