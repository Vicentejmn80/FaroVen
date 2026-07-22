import { useMissionApplications, useApproveApplication, useRejectApplication } from '@/hooks/useMissionApplications'
import { useAuth, usePermissions } from '@/store/auth-context'
import { ApplicationCard } from './application-card'
import { GlassCard } from '@/components/ui/glass-card'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Inbox, Users } from 'lucide-react'
import { OP_LABELS } from '@/lib/labels'

interface PostulationPanelProps {
  missionId: string
}

function PostulationSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={OP_LABELS.loading}>
      {[1, 2, 3].map((i) => (
        <GlassCard key={i} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-32 animate-pulse rounded-lg bg-white/[0.08]" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-3 w-48 animate-pulse rounded bg-white/[0.05]" />
          <div className="flex gap-2">
            <div className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

export function PostulationPanel({ missionId }: PostulationPanelProps) {
  const { profile, user } = useAuth()
  const { isCaseManager, isCoordinator, isRegionalAdmin, isSuperAdmin } = usePermissions()
  const canModerate = isCaseManager || isCoordinator || isRegionalAdmin || isSuperAdmin
  const { data: applications, isLoading } = useMissionApplications(missionId)
  const approveMutation = useApproveApplication()
  const rejectMutation = useRejectApplication()
  const operatorId = user?.id ?? profile?.id ?? ''

  const pending = useMemo(() => applications?.filter((a) => a.status === 'pending') ?? [], [applications])
  const history = useMemo(() => applications?.filter((a) => a.status !== 'pending') ?? [], [applications])

  if (isLoading) return <PostulationSkeleton />

  if (!applications || applications.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 p-6 text-center">
        <Inbox className="h-8 w-8 text-ink-faint" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">Sin postulaciones aún</p>
        <p className="text-xs text-ink-subtle">
          Cuando los voluntarios ofrezcan ayuda, aparecerán aquí para revisión.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Pendientes
            </p>
            <motion.span
              animate={{ scale: [1, 1.12, 1], opacity: [1, 0.75, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning/25 px-1.5 text-[10px] font-bold text-warning"
            >
              {pending.length}
            </motion.span>
          </div>
          <div className="space-y-2">
            {pending.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onApprove={
                  canModerate && operatorId
                    ? () =>
                        approveMutation.mutate({
                          applicationId: app.id,
                          operatorId,
                        })
                    : undefined
                }
                onReject={
                  canModerate && operatorId
                    ? () =>
                        rejectMutation.mutate({
                          applicationId: app.id,
                          operatorId,
                        })
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-ink-faint" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Historial ({history.length})
            </p>
          </div>
          <div className="space-y-2 opacity-70">
            {history.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
