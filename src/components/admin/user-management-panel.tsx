import { useMemo, useState } from 'react'
import { Building2, Shield, UserCog, Users } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { FlowSheet } from '@/components/faro/flow-sheet'
import type { ProfileRow } from '@/repositories/auth-types'
import type { Site } from '@/lib/types'
import { FARO_ROLE_LABELS, FARO_ROLES } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface UserManagementPanelProps {
  profiles: ProfileRow[]
  sites: Site[]
  currentUserId?: string
  busyId: string | null
  onPromoteAdmin: (userId: string) => Promise<void>
  onPromoteCoordinator: (userId: string, siteId: string) => Promise<void>
}

export function UserManagementPanel({
  profiles,
  sites,
  currentUserId,
  busyId,
  onPromoteAdmin,
  onPromoteCoordinator,
}: UserManagementPanelProps) {
  const [coordinatorTarget, setCoordinatorTarget] = useState<ProfileRow | null>(null)
  const [adminTarget, setAdminTarget] = useState<ProfileRow | null>(null)
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')

  const registeredSites = useMemo(
    () => sites.filter((s) => s.type !== 'organization').sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [sites],
  )

  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
      }),
    [profiles],
  )

  async function confirmCoordinator() {
    if (!coordinatorTarget || !selectedSiteId) return
    await onPromoteCoordinator(coordinatorTarget.id, selectedSiteId)
    setCoordinatorTarget(null)
    setSelectedSiteId('')
  }

  async function confirmAdmin() {
    if (!adminTarget) return
    await onPromoteAdmin(adminTarget.id)
    setAdminTarget(null)
  }

  return (
    <>
      <section className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Usuarios registrados
        </p>
        {sortedProfiles.length === 0 ? (
          <EmptyState icon={Users} title="Sin perfiles registrados" />
        ) : (
          sortedProfiles.map((profile) => {
            const isSelf = profile.id === currentUserId
            const roleLabel = profile.role ? FARO_ROLE_LABELS[profile.role] : FARO_ROLE_LABELS[FARO_ROLES.PUBLIC]
            const canPromote =
              !isSelf &&
              profile.role !== FARO_ROLES.SUPER_ADMIN &&
              profile.status === 'active'

            return (
              <GlassCard key={profile.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {profile.full_name || profile.email}
                    </p>
                    <p className="truncate text-xs text-ink-subtle">{profile.email}</p>
                    {profile.created_at && (
                      <p className="mt-1 text-[11px] text-ink-faint">
                        Registro: {new Date(profile.created_at).toLocaleDateString('es-VE')}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info">
                    {roleLabel}
                  </span>
                </div>

                {canPromote && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <EmergencyButton
                      variant="glass"
                      size="sm"
                      className="w-full"
                      disabled={busyId === profile.id}
                      onClick={() => {
                        setSelectedSiteId('')
                        setCoordinatorTarget(profile)
                      }}
                    >
                      <Building2 className="h-4 w-4" />
                      Promover a coordinador
                    </EmergencyButton>
                    {profile.role !== FARO_ROLES.REGIONAL_ADMIN && (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="w-full"
                        disabled={busyId === profile.id}
                        onClick={() => setAdminTarget(profile)}
                      >
                        <Shield className="h-4 w-4" />
                        Promover a admin regional
                      </EmergencyButton>
                    )}
                  </div>
                )}

                {isSelf && (
                  <p className="text-xs text-ink-subtle">Tu cuenta (Super administrador)</p>
                )}
              </GlassCard>
            )
          })
        )}
      </section>

      {coordinatorTarget && (
        <FlowSheet
          title="Asignar centro"
          subtitle={`Coordinador: ${coordinatorTarget.full_name || coordinatorTarget.email}`}
          onClose={() => {
            setCoordinatorTarget(null)
            setSelectedSiteId('')
          }}
        >
          <div className="space-y-3 px-5 pb-8">
            <p className="text-sm text-ink-muted">
              Selecciona el hospital, refugio o acopio que administrará esta persona.
            </p>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {registeredSites.map((site) => (
                <li key={site.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedSiteId(site.id)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                      selectedSiteId === site.id
                        ? 'border-info/50 bg-info/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <p className="text-sm font-medium text-ink">{site.name}</p>
                    <p className="text-xs text-ink-subtle">{site.zone}</p>
                  </button>
                </li>
              ))}
            </ul>
            {registeredSites.length === 0 && (
              <p className="text-sm text-ink-subtle">No hay centros registrados aún.</p>
            )}
            <EmergencyButton
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!selectedSiteId || busyId === coordinatorTarget.id}
              onClick={() => void confirmCoordinator()}
            >
              <UserCog className="h-4 w-4" />
              Confirmar coordinador
            </EmergencyButton>
          </div>
        </FlowSheet>
      )}

      {adminTarget && (
        <FlowSheet
          title="Promover a admin regional"
          subtitle={adminTarget.full_name || adminTarget.email}
          onClose={() => setAdminTarget(null)}
        >
          <div className="space-y-4 px-5 pb-8">
            <GlassCard className="space-y-2 bg-white/[0.03]">
              <p className="text-sm font-medium text-ink">¿Qué podrá hacer?</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
                <li>Revisar y aprobar solicitudes de coordinador</li>
                <li>Gestionar centros desde el panel Administración</li>
                <li>Recibir notificaciones de solicitudes</li>
              </ul>
              <p className="text-sm text-ink-subtle">
                No tendrá acceso al panel Sistema ni podrá promover a otros usuarios.
              </p>
            </GlassCard>
            <EmergencyButton
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busyId === adminTarget.id}
              onClick={() => void confirmAdmin()}
            >
              <Shield className="h-4 w-4" />
              Confirmar admin regional
            </EmergencyButton>
          </div>
        </FlowSheet>
      )}
    </>
  )
}
