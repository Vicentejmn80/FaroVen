import { GlassCard } from '@/components/ui/glass-card'
import type { AppStatusSnapshot } from '@/domain/guide-models'
import { timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ResourceSection } from '../shared/resource-section'

interface AppStatusSectionProps {
  status: AppStatusSnapshot
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const valueClass =
    tone === 'ok' ? 'text-operational' : tone === 'warn' ? 'text-warning' : tone === 'bad' ? 'text-critical' : 'text-ink'
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={cn('text-sm font-medium', valueClass)}>{value}</span>
    </div>
  )
}

export function AppStatusSection({ status }: AppStatusSectionProps) {
  const serverTone =
    status.serverStatus === 'online' ? 'ok' : status.serverStatus === 'degraded' ? 'warn' : 'bad'
  const syncTone =
    status.syncStatus === 'synced' ? 'ok' : status.syncStatus === 'cached' ? 'warn' : 'bad'

  return (
    <ResourceSection id="guide-status" title="Estado de la aplicación">
      <GlassCard inset={false} className="divide-y divide-white/[0.06] px-4 py-1">
        <StatusRow label="Versión" value={`FARO ${status.version}`} />
        <StatusRow label="Entorno" value={status.lastDeployLabel} />
        <StatusRow
          label="Servidor"
          value={status.serverStatus === 'online' ? 'En línea' : status.serverStatus === 'degraded' ? 'Degradado' : 'Sin conexión'}
          tone={serverTone}
        />
        <StatusRow
          label="Sincronización"
          value={status.syncStatus === 'synced' ? 'Actualizado' : status.syncStatus === 'cached' ? 'Datos en caché' : 'Offline'}
          tone={syncTone}
        />
        <StatusRow label="Modo offline" value={status.offlineMode ? 'Activo' : 'Inactivo'} tone={status.offlineMode ? 'warn' : 'ok'} />
        <StatusRow
          label="Última sync"
          value={status.lastSyncAt ? timeAgo(status.lastSyncAt) : 'Sin datos'}
        />
      </GlassCard>
    </ResourceSection>
  )
}
