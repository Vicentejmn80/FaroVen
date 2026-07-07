import { useMemo, useState } from 'react'
import { Building2, Pencil, Shield, Trash2, UserCog, UserMinus, Users, UserX } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { FlowSheet } from '@/components/faro/flow-sheet'
import type { AdminCoordinatorRow } from '@/lib/admin-types'
import type { ProfileRow } from '@/repositories/auth-types'
import type { Site } from '@/lib/types'
import {
  FARO_ROLES,
  PROFILE_STATUS_LABELS,
  resolveDisplayRoleLabel,
} from '@/lib/roles'
import { cn } from '@/lib/utils'

interface UserManagementPanelProps {
  profiles: ProfileRow[]
  sites: Site[]
  coordinatorByUserId?: Map<string, AdminCoordinatorRow>
  currentUserId?: string
  busyId: string | null
  onPromoteAdmin: (userId: string) => Promise<void>
  onPromoteCoordinator: (userId: string, siteId: string) => Promise<void>
  onUserAction?: (action: string, profile: ProfileRow, extra?: boolean) => Promise<void>
}

export function UserManagementPanel({
  profiles,
  sites,
  coordinatorByUserId,
  currentUserId,
  busyId,
  onPromoteAdmin,
  onPromoteCoordinator,
  onUserAction,
}: UserManagementPanelProps) {
  const [coordinatorTarget, setCoordinatorTarget] = useState<ProfileRow | null>(null)
  const [adminTarget, setAdminTarget] = useState<ProfileRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null)
  const [confirmSuperAdminDelete, setConfirmSuperAdminDelete] = useState(false)
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
            const assignment = coordinatorByUserId?.get(profile.id)
            const hasAssignment = Boolean(assignment?.site_id)
            const roleLabel = resolveDisplayRoleLabel(profile, hasAssignment)
            const canManage =
              !isSelf &&
              profile.role !== FARO_ROLES.SUPER_ADMIN &&
              onUserAction

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
                    {profile.phone && (
                      <p className="truncate text-xs text-ink-muted">{profile.phone}</p>
                    )}
                    {profile.created_at && (
                      <p className="mt-1 text-[11px] text-ink-faint">
                        Registro: {new Date(profile.created_at).toLocaleDateString('es-VE')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info">
                      {roleLabel}
                    </span>
                    <span className="text-[10px] text-ink-subtle">
                      {PROFILE_STATUS_LABELS[profile.status]}
                    </span>
                  </div>
                </div>

                {profile.role === FARO_ROLES.COORDINATOR && hasAssignment && assignment && (
                  <div className="rounded-2xl border border-info/20 bg-info/10 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-info">Centro asignado</p>
                    <p className="text-sm font-medium text-ink">{assignment.site_name ?? '—'}</p>
                  </div>
                )}

                {profile.role === FARO_ROLES.COORDINATOR && !hasAssignment && (
                  <p className="text-xs text-warning">Rol coordinador sin centro — requiere asignación.</p>
                )}

                {canPromote && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <EmergencyButton
                      variant="glass"
                      size="sm"
                      className="w-full"
                      disabled={busyId === profile.id}
                      onClick={() => {
                        setSelectedSiteId(assignment?.site_id ?? '')
                        setCoordinatorTarget(profile)
                      }}
                    >
                      <Building2 className="h-4 w-4" />
                      {profile.role === FARO_ROLES.COORDINATOR ? 'Reasignar centro' : 'Promover a coordinador'}
                    </EmergencyButton>
                    {profile.role !== FARO_ROLES.REGIONAL_ADMIN && profile.role !== FARO_ROLES.COORDINATOR && (
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

                {canManage && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {profile.role === FARO_ROLES.COORDINATOR && (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="w-full text-critical"
                        disabled={busyId === profile.id}
                        onClick={() => void onUserAction('revoke-coordinator', profile)}
                      >
                        <UserMinus className="h-4 w-4" />
                        Quitar rol coordinador
                      </EmergencyButton>
                    )}
                    {profile.role === FARO_ROLES.REGIONAL_ADMIN && (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="w-full"
                        disabled={busyId === profile.id}
                        onClick={() => void onUserAction?.('demote', profile)}
                      >
                        Quitar rol admin
                      </EmergencyButton>
                    )}
                    {profile.status === 'active' ? (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="w-full text-critical"
                        disabled={busyId === profile.id}
                        onClick={() => void onUserAction('suspend', profile)}
                      >
                        <UserX className="h-4 w-4" />
                        Suspender
                      </EmergencyButton>
                    ) : (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="w-full"
                        disabled={busyId === profile.id}
                        onClick={() => void onUserAction('activate', profile)}
                      >
                        Reactivar
                      </EmergencyButton>
                    )}
                    {!isSelf && (
                      <EmergencyButton
                        variant="glass"
                        size="sm"
                        className="w-full text-critical sm:col-span-2"
                        disabled={busyId === profile.id}
                        onClick={() => {
                          setConfirmSuperAdminDelete(false)
                          setDeleteTarget(profile)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar usuario
                      </EmergencyButton>
                    )}
                  </div>
                )}

                {canManage && profile.role !== FARO_ROLES.SUPER_ADMIN && (
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="w-full"
                    disabled={busyId === profile.id}
                    onClick={() => void onUserAction?.('edit-profile', profile)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar perfil
                  </EmergencyButton>
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
              Debes seleccionar el hospital, refugio o acopio antes de confirmar. No se guardará sin un centro válido.
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

      {deleteTarget && (
        <FlowSheet
          title="Eliminar usuario permanentemente"
          subtitle={deleteTarget.full_name || deleteTarget.email}
          onClose={() => {
            setDeleteTarget(null)
            setConfirmSuperAdminDelete(false)
          }}
        >
          <div className="space-y-4 px-5 pb-8">
            <GlassCard className="space-y-2 border-critical/30 bg-critical/5">
              <p className="text-sm font-medium text-critical">Acción irreversible</p>
              <p className="text-sm text-ink-muted">
                Se eliminarán el perfil, datos de coordinador, preferencias, suscripciones push y la cuenta de Auth.
              </p>
            </GlassCard>
            {deleteTarget.role === FARO_ROLES.SUPER_ADMIN && (
              <label className="flex items-start gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={confirmSuperAdminDelete}
                  onChange={(e) => setConfirmSuperAdminDelete(e.target.checked)}
                  className="mt-1"
                />
                Confirmo eliminar a otro Super Administrador
              </label>
            )}
            <EmergencyButton
              variant="primary"
              size="lg"
              className="w-full bg-critical hover:bg-critical/90"
              disabled={
                busyId === deleteTarget.id ||
                (deleteTarget.role === FARO_ROLES.SUPER_ADMIN && !confirmSuperAdminDelete)
              }
              onClick={async () => {
                if (!onUserAction) return
                await onUserAction('delete-user', deleteTarget, confirmSuperAdminDelete)
                setDeleteTarget(null)
                setConfirmSuperAdminDelete(false)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar definitivamente
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
