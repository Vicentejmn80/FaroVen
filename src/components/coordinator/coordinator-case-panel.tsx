import type { CaseDomain } from '@/domain/case-lifecycle.types'
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, PIPELINE_STAGE_TONES } from '@/domain/case-lifecycle.types'
import {
  useCoordinatorCases,
  useAcceptCoordinatorCase,
  useRejectCoordinatorCase,
  useResolveCoordinatorCase,
  useStartCoordinatorAttention,
} from '@/hooks/useCoordinatorCases'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn, timeAgo } from '@/lib/utils'
import { useState } from 'react'

function StageBadge({ stage }: { stage: string }) {
  const tone = PIPELINE_STAGE_TONES[stage as keyof typeof PIPELINE_STAGE_TONES]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>
      {PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] ?? stage}
    </span>
  )
}

function CaseCard({ caseItem }: { caseItem: CaseDomain }) {
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const accept = useAcceptCoordinatorCase()
  const reject = useRejectCoordinatorCase()
  const resolve = useResolveCoordinatorCase()
  const start = useStartCoordinatorAttention()

  const isAssigned = caseItem.pipelineStage === PIPELINE_STAGES.ASSIGNED
  const isAccepted = caseItem.pipelineStage === PIPELINE_STAGES.ACCEPTED
  const isInAttention = caseItem.pipelineStage === PIPELINE_STAGES.IN_ATTENTION

  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-ink truncate">{caseItem.title}</h4>
          <p className="text-xs text-ink-subtle mt-0.5">
            {caseItem.zone} &middot; {timeAgo(caseItem.createdAt)}
          </p>
        </div>
        <StageBadge stage={caseItem.pipelineStage} />
      </div>

      {caseItem.description && (
        <p className="text-xs text-ink-muted line-clamp-2">{caseItem.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isAssigned && (
          <>
            <EmergencyButton
              variant="primary"
              size="sm"
              onClick={() => accept.mutate(caseItem.id)}
              disabled={accept.isPending}
            >
              Aceptar caso
            </EmergencyButton>
            <EmergencyButton
              variant="glass"
              size="sm"
              onClick={() => setRejecting(true)}
              disabled={reject.isPending}
            >
              Rechazar
            </EmergencyButton>
          </>
        )}
        {isAccepted && (
          <EmergencyButton
            variant="primary"
            size="sm"
            onClick={() => start.mutate(caseItem.id)}
            disabled={start.isPending}
          >
            Iniciar atención
          </EmergencyButton>
        )}
        {isInAttention && (
          <EmergencyButton
            variant="primary"
            size="sm"
            onClick={() => resolve.mutate(caseItem.id)}
            disabled={resolve.isPending}
          >
            Resolver caso
          </EmergencyButton>
        )}
      </div>

      {rejecting && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <textarea
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint resize-none"
            rows={2}
            placeholder="Motivo del rechazo..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <EmergencyButton
              variant="primary"
              size="sm"
              onClick={async () => {
                await reject.mutateAsync({ caseId: caseItem.id, reason: rejectReason })
                setRejecting(false)
                setRejectReason('')
              }}
              disabled={reject.isPending || !rejectReason.trim()}
            >
              Confirmar rechazo
            </EmergencyButton>
            <EmergencyButton variant="glass" size="sm" onClick={() => setRejecting(false)}>
              Cancelar
            </EmergencyButton>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

export function CoordinatorCasePanel() {
  const { assignment } = useCoordinatorAssignment()
  const { data: cases, isLoading, error } = useCoordinatorCases(assignment?.siteId ?? '')

  if (!assignment) {
    return (
      <div className="p-4 text-center text-sm text-ink-muted">
        No tienes un centro asignado
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} className="h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-sm text-critical">
        Error al cargar casos: {(error as Error).message}
      </div>
    )
  }

  const assigned = (cases ?? []).filter((c) => c.pipelineStage === PIPELINE_STAGES.ASSIGNED)
  const active = (cases ?? []).filter(
    (c) =>
      c.pipelineStage === PIPELINE_STAGES.ACCEPTED || c.pipelineStage === PIPELINE_STAGES.IN_ATTENTION,
  )
  const resolved = (cases ?? []).filter(
    (c) =>
      c.pipelineStage === PIPELINE_STAGES.RESOLVED || c.pipelineStage === PIPELINE_STAGES.ARCHIVED,
  )

  if ((cases ?? []).length === 0) {
    return (
      <div className="p-4">
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-ink-subtle">No hay casos asignados a tu centro</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      {assigned.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">
            Pendientes de aceptación ({assigned.length})
          </h3>
          <div className="space-y-3">
            {assigned.map((c) => (
              <CaseCard key={c.id} caseItem={c} />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">
            En atención ({active.length})
          </h3>
          <div className="space-y-3">
            {active.map((c) => (
              <CaseCard key={c.id} caseItem={c} />
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink-subtle mb-3">
            Resueltos ({resolved.length})
          </h3>
          <div className="space-y-3">
            {resolved.map((c) => (
              <GlassCard key={c.id} className="p-4 opacity-70">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-ink truncate">{c.title}</h4>
                    <p className="text-xs text-ink-subtle mt-0.5">{timeAgo(c.createdAt)}</p>
                  </div>
                  <StageBadge stage={c.pipelineStage} />
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
