import { useState } from 'react'
import { Shield } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { GlassCard } from '@/components/ui/glass-card'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { SystemHealthPanel } from '@/components/admin/system-health-panel'
import { UserManagementPanel } from '@/components/admin/user-management-panel'
import { RequireRole } from '@/components/auth/require-role'
import { useAdminProfiles } from '@/hooks/useAuthRequests'
import { useAuditTimeline } from '@/hooks/useAuditTimeline'
import { FARO_ROLES } from '@/lib/roles'
import { authService } from '@/services/auth-service'
import { formatAuthError } from '@/lib/auth-errors'
import { useAuth } from '@/store/auth-context'
import { useFaro } from '@/store/faro-context'
import { siteToNeedableType } from '@/lib/site-utils'

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
  const { user, refreshProfile } = useAuth()
  const { sites } = useFaro()
  const { data: profiles = [], refetch } = useAdminProfiles(true)
  const auditTimeline = useAuditTimeline(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function promoteAdmin(userId: string) {
    setBusyId(userId)
    setError(null)
    try {
      await authService.promoteUserRole(userId, 'regional_admin')
      await refetch()
      await refreshProfile()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo promover'))
    } finally {
      setBusyId(null)
    }
  }

  async function promoteCoordinator(userId: string, siteId: string) {
    const site = sites.find((s) => s.id === siteId)
    if (!site || site.type === 'organization') {
      setError('Centro no válido.')
      return
    }

    setBusyId(userId)
    setError(null)
    try {
      await authService.assignCoordinatorRole(userId, siteToNeedableType(site), siteId)
      await refetch()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo asignar coordinador'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ScreenScaffold title="Sistema" subtitle="Super administración">
      <div className="space-y-4 pt-2">
        <ContextualHelpCard moduleId="system" />
        <GlassCard className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-info" />
          <div>
            <p className="text-sm font-medium text-ink">Panel global FARO</p>
            <p className="text-xs text-ink-subtle">
              Gestiona usuarios, promueve roles y revisa la auditoría del sistema.
            </p>
          </div>
        </GlassCard>

        {error && <p className="text-sm text-critical">{error}</p>}

        <SystemHealthPanel />

        <UserManagementPanel
          profiles={profiles}
          sites={sites}
          currentUserId={user?.id}
          busyId={busyId}
          onPromoteAdmin={promoteAdmin}
          onPromoteCoordinator={promoteCoordinator}
        />

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Auditoría</p>
          <AuditTimeline entries={auditTimeline.entries} loading={auditTimeline.isLoading} />
        </section>
      </div>
    </ScreenScaffold>
  )
}
