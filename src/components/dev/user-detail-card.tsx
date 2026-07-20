import { User, Phone, MapPin, Calendar, Shield, Building2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { StatusBadge } from '@/components/coordinator/status-badge'
import type { DevProfileRow } from '@/services/dev-service'
import { ROLE_LABELS } from '@/services/dev-service'
import type { OperationalStatus } from '@/domain/models'

interface UserDetailCardProps {
  user: DevProfileRow
}

export function UserDetailCard({ user }: UserDetailCardProps) {
  const status = (user.status === 'active' ? 'operational'
    : user.status === 'suspended' ? 'critical'
    : 'warning') as OperationalStatus

  const statusLabel = user.status === 'active' ? 'Activo'
    : user.status === 'suspended' ? 'Suspendido'
    : 'Pendiente'

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/15">
            <User className="h-6 w-6 text-info" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">{user.full_name || 'Sin nombre'}</p>
            <p className="text-xs text-ink-subtle">{user.email}</p>
          </div>
        </div>
        <StatusBadge status={status} label={statusLabel} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoRow icon={Shield} label="Rol actual" value={ROLE_LABELS[user.role ?? 'public']} />
        <InfoRow icon={Building2} label="Centro" value={user.coordinator_site_name ?? 'Sin asignar'} />
        <InfoRow icon={MapPin} label="Municipio" value={user.municipality ?? '—'} />
        <InfoRow icon={Calendar} label="Registro" value={new Date(user.created_at).toLocaleDateString('es-VE')} />
      </div>

      {(user.phone || user.profession || user.organization_name) && (
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          {user.phone && <InfoRow icon={Phone} label="Teléfono" value={user.phone} />}
          {user.profession && <InfoRow icon={User} label="Profesión" value={user.profession} />}
          {user.organization_name && <InfoRow icon={Building2} label="Organización" value={user.organization_name} />}
        </div>
      )}
    </GlassCard>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={1.75} />
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className="truncate text-xs font-medium text-ink">{value}</span>
    </div>
  )
}
