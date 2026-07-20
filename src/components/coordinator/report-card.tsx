import { CheckCircle2, XCircle, Eye, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'
import type { Report } from '@/domain/models'

interface ReportCardProps {
  report: Report
  onView: (report: Report) => void
  onApprove?: (reportId: string) => void
  onDismiss?: (reportId: string) => void
}

const STATUS_CONFIG = {
  new: {
    label: 'Pendiente',
    class: 'bg-warning-soft text-warning',
    icon: Clock,
  },
  verified: {
    label: 'Aprobado',
    class: 'bg-operational-soft text-operational',
    icon: CheckCircle2,
  },
  discarded: {
    label: 'Rechazado',
    class: 'bg-white/[0.06] text-ink-subtle',
    icon: XCircle,
  },
}

export function ReportCard({ report, onView, onApprove, onDismiss }: ReportCardProps) {
  const config = STATUS_CONFIG[report.status]
  const Icon = config.icon
  const isPending = report.status === 'new'

  return (
    <GlassCard className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            config.class,
          )}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
        <span className="text-[11px] text-ink-faint">{timeAgo(report.createdAt)}</span>
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-ink">{report.description}</p>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-subtle">{report.source}</p>
        <div className="flex gap-1.5">
          <EmergencyButton variant="glass" size="sm" onClick={() => onView(report)}>
            <Eye className="h-3.5 w-3.5" /> Ver
          </EmergencyButton>
          {isPending && onApprove && (
            <EmergencyButton
              variant="glass"
              size="sm"
              onClick={() => onApprove(report.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
            </EmergencyButton>
          )}
          {isPending && onDismiss && (
            <EmergencyButton
              variant="glass"
              size="sm"
              className="text-critical"
              onClick={() => onDismiss(report.id)}
            >
              <XCircle className="h-3.5 w-3.5" /> Descartar
            </EmergencyButton>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
