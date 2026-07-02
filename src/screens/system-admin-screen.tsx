import { useState } from 'react'
import { Shield, UserCog, Users } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { SystemHealthPanel } from '@/components/admin/system-health-panel'
import { EmptyState } from '@/components/ui/empty-state'
import { RequireRole } from '@/components/auth/require-role'
import { useAdminProfiles } from '@/hooks/useAuthRequests'
import { useAuditTimeline } from '@/hooks/useAuditTimeline'
import { FARO_ROLES, FARO_ROLE_LABELS } from '@/lib/roles'
import { authService } from '@/services/auth-service'
import { formatAuthError } from '@/lib/auth-errors'
import { useAuth } from '@/store/auth-context'

interface SystemAdminScreenProps {
  onRequestAuth?: () => void
}

export function SystemAdminScreen({ onRequestAuth }: SystemAdminScreenProps) {
  return (
    <RequireRole allowed={[FARO_ROLES.SUPER_ADMIN]} onRequestAuth={onRequestAuth}>
      <SystemAdminScreenContent />
    </RequireRole>
  )
}

function SystemAdminScreenContent() {
  const { refreshProfile } = useAuth()
  const { data: profiles = [], refetch } = useAdminProfiles(true)
  const auditTimeline = useAuditTimeline(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function promote(userId: string, role: 'regional_admin' | 'coordinator') {
    setBusyId(userId)
    setError(null)
    try {
      await authService.promoteUserRole(userId, role)
      await refetch()
      await refreshProfile()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo promover'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ScreenScaffold title="Sistema" subtitle="Super administración">
      <div className="space-y-4 pt-2">
        <GlassCard className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-info" />
          <div>
            <p className="text-sm font-medium text-ink">Panel global FARO</p>
            <p className="text-xs text-ink-subtle">
              Tú eres Super Admin. Aquí promueves administradores regionales y ves auditoría.
            </p>
          </div>
        </GlassCard>

        {error && <p className="text-sm text-critical">{error}</p>}

        <SystemHealthPanel />

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Usuarios registrados
          </p>
          {profiles.length === 0 ? (
            <EmptyState icon={Users} title="Sin perfiles registrados" />
          ) : (
            profiles.map((profile) => (
              <GlassCard key={profile.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{profile.full_name || profile.email}</p>
                    <p className="text-xs text-ink-subtle">{profile.email}</p>
                  </div>
                  <span className="text-xs text-info">
                    {profile.role ? FARO_ROLE_LABELS[profile.role] : 'Ciudadano'}
                  </span>
                </div>

                {!profile.role && (
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="w-full"
                    disabled={busyId === profile.id}
                    onClick={() => void promote(profile.id, 'regional_admin')}
                  >
                    <UserCog className="h-4 w-4" /> Promover a Admin regional
                  </EmergencyButton>
                )}
              </GlassCard>
            ))
          )}
        </section>

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Auditoría</p>
          <AuditTimeline entries={auditTimeline.entries} loading={auditTimeline.isLoading} />
        </section>
      </div>
    </ScreenScaffold>
  )
}
