import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  ClipboardList,
  FileQuestion,
  Flag,
  HeartPulse,
  Home,
  Package,
  ScrollText,
  Shield,
  Trash2,
  Users,
  UserCog,
  Warehouse,
  Wrench,
  FlaskConical,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { SystemHealthPanel } from '@/components/admin/system-health-panel'
import { UserManagementPanel } from '@/components/admin/user-management-panel'
import { CreateCenterWizard } from '@/components/admin/create-center-wizard'
import { CoordinatorRequestReview } from '@/components/admin/coordinator-request-review'
import { FlowSheet } from '@/components/faro/flow-sheet'
import { fieldClassName } from '@/components/faro/flow-sheet'
import { useAdminProfiles, useCoordinatorRequestMutations, usePendingCoordinatorRequests } from '@/hooks/useAuthRequests'
import { useAuditTimeline } from '@/hooks/useAuditTimeline'
import {
  useAdminCoordinators,
  useAdminEvents,
  useAdminMutations,
  useAdminNeeds,
  useAdminNotificationsList,
  useAdminOperationalSettings,
  useAdminPublicNeeds,
  useAdminRegistry,
  useAdminReports,
} from '@/hooks/useAdminConsole'
import type { AdminCoordinatorRow, AdminRegistryRow, SuperAdminModuleId } from '@/lib/admin-types'
import { authService } from '@/services/auth-service'
import { formatAuthError } from '@/lib/auth-errors'
import { DevWorkspace } from '@/components/dev/dev-workspace'
import { useAuth } from '@/store/auth-context'
import { useFaro } from '@/store/faro-context'
import { siteToNeedableType } from '@/lib/site-utils'
import type { ProfileRow, CoordinatorRequestRow } from '@/repositories/auth-types'
import type { Site } from '@/lib/types'
import type { Need, Report } from '@/domain/models'
import type { Event } from '@/domain/models'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import {
  NOTIFICATION_TYPE_LABELS,
  PRIORITY_LABELS,
  REPORT_STATUS_LABELS,
  SITE_TYPE_LABELS,
  label,
} from '@/lib/labels'

function invalidateSitesCache(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centers] })
  void queryClient.invalidateQueries({ queryKey: ['sites-registry'] })
  void queryClient.invalidateQueries({ queryKey: ['anchor-sites'] })
}

const MODULES: { id: SuperAdminModuleId; label: string; icon: typeof Users; description: string }[] = [
  { id: 'users', label: 'Usuarios', icon: Users, description: 'Roles, estado y perfiles' },
  { id: 'coordinators', label: 'Coordinadores', icon: UserCog, description: 'Asignaciones y centros' },
  { id: 'requests', label: 'Solicitudes', icon: FileQuestion, description: 'Aprobar o rechazar acceso' },
  { id: 'hospitals', label: 'Hospitales', icon: HeartPulse, description: 'Registro y mantenimiento' },
  { id: 'shelters', label: 'Refugios', icon: Home, description: 'Registro y mantenimiento' },
  { id: 'supply_centers', label: 'Acopios', icon: Warehouse, description: 'Centros de acopio' },
  { id: 'needs', label: 'Necesidades', icon: ClipboardList, description: 'CRUD global' },
  { id: 'public_needs', label: 'Necesidades públicas', icon: Flag, description: 'Radar ciudadano / voluntarios' },
  { id: 'reports', label: 'Reportes', icon: ScrollText, description: 'Moderación ciudadana' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, description: 'Bandeja del sistema' },
  { id: 'inventory', label: 'Inventario', icon: Package, description: 'Stock por centro' },
  { id: 'events', label: 'Eventos', icon: Calendar, description: 'Timeline operativo' },
  { id: 'audit', label: 'Auditoría', icon: Shield, description: 'Eventos auth y operativos' },
  { id: 'operational_settings', label: 'Configuración operativa', icon: Wrench, description: 'Ciclo operativo de necesidades' },
  { id: 'maintenance', label: 'Mantenimiento', icon: Wrench, description: 'Limpieza y saneamiento del tablero' },
  { id: 'dev_reset', label: 'Limpieza dev', icon: Trash2, description: 'Reset operacional (solo dev)' },
  { id: 'lab', label: 'Laboratorio', icon: FlaskConical, description: 'Herramientas de desarrollo' },
]

export function SuperAdminConsole() {
  const [activeModule, setActiveModule] = useState<SuperAdminModuleId | null>(null)
  const { user, refreshProfile, simulatedRole, setSimulatedRole, canAccessSystemPanel } = useAuth()
  const queryClient = useQueryClient()
  const { sites } = useFaro()
  // Solo disparar RPCs admin si el rol lo requiere y el módulo activo las usa
  const canAdmin = canAccessSystemPanel
  const loadUsers = canAdmin && (activeModule === 'users' || activeModule === 'coordinators' || activeModule === 'requests')
  const loadRequests = canAdmin && activeModule === 'requests'
  const loadRegistry = canAdmin && (
    activeModule === 'hospitals' ||
    activeModule === 'shelters' ||
    activeModule === 'supply_centers' ||
    activeModule === 'coordinators'
  )
  const loadCoordinators = canAdmin && (activeModule === 'coordinators' || activeModule === 'users')
  const loadNeeds = canAdmin && (activeModule === 'needs' || activeModule === 'inventory')
  const loadPublicNeeds = canAdmin && activeModule === 'public_needs'
  const loadReports = canAdmin && activeModule === 'reports'
  const loadEvents = canAdmin && activeModule === 'events'
  const loadNotifications = canAdmin && activeModule === 'notifications'
  const loadOperational = canAdmin && activeModule === 'operational_settings'
  const loadAudit = canAdmin && activeModule === 'audit'

  const { data: profiles = [], refetch: refetchProfiles } = useAdminProfiles(loadUsers)
  const auditTimeline = useAuditTimeline(loadAudit)
  const registry = useAdminRegistry(loadRegistry)
  const coordinators = useAdminCoordinators(loadCoordinators)
  const needs = useAdminNeeds(loadNeeds)
  const publicNeeds = useAdminPublicNeeds(loadPublicNeeds)
  const reports = useAdminReports(loadReports)
  const events = useAdminEvents(loadEvents)
  const notifications = useAdminNotificationsList(loadNotifications)
  const operationalSettings = useAdminOperationalSettings(loadOperational)
  const pendingRequests = usePendingCoordinatorRequests(loadRequests)
  const requestMutations = useCoordinatorRequestMutations()
  const mutations = useAdminMutations()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreateCenter, setShowCreateCenter] = useState(false)
  const [editProfile, setEditProfile] = useState<ProfileRow | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [requestAssignments, setRequestAssignments] = useState<Record<string, string>>({})
  const [devResetConfirm, setDevResetConfirm] = useState('')
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)

  const coordinatorByUserId = useMemo(() => {
    const map = new Map<string, AdminCoordinatorRow>()
    for (const row of coordinators.data ?? []) {
      map.set(row.auth_user_id, row)
    }
    return map
  }, [coordinators.data])

  const coordinatorBySiteId = useMemo(() => {
    const map = new Map<string, AdminCoordinatorRow>()
    for (const row of coordinators.data ?? []) {
      map.set(row.site_id, row)
    }
    return map
  }, [coordinators.data])

  async function promoteAdmin(userId: string) {
    setBusyId(userId)
    setError(null)
    try {
      await authService.promoteUserRole(userId, 'regional_admin')
      await refetchProfiles()
      await refreshProfile()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo promover'))
    } finally {
      setBusyId(null)
    }
  }

  async function promoteCaseManager(userId: string) {
    setBusyId(userId)
    setError(null)
    try {
      await authService.promoteUserRole(userId, 'case_manager')
      await refetchProfiles()
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
      await refetchProfiles()
      await coordinators.refetch()
      await registry.refetch()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo asignar coordinador'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleUserAction(action: string, profile: ProfileRow, extra?: boolean) {
    setBusyId(profile.id)
    setError(null)
    try {
      if (action === 'suspend') {
        await mutations.updateUserStatus.mutateAsync({ userId: profile.id, status: 'suspended' })
      } else if (action === 'activate') {
        await mutations.updateUserStatus.mutateAsync({ userId: profile.id, status: 'active' })
      } else if (action === 'revoke-coordinator') {
        await mutations.revokeCoordinatorRole.mutateAsync(profile.id)
      } else if (action === 'demote') {
        await mutations.demoteUser.mutateAsync(profile.id)
      } else if (action === 'delete-user') {
        await mutations.deleteUser.mutateAsync({ userId: profile.id, confirmSuperAdmin: extra })
      } else if (action === 'edit-profile') {
        setEditProfile(profile)
        setEditFullName(profile.full_name)
        setEditPhone(profile.phone ?? '')
        setBusyId(null)
        return
      }
      await refetchProfiles()
      await refreshProfile()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'Operación fallida'))
    } finally {
      setBusyId(null)
    }
  }

  const pendingNetworkRequests = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.role_request_status === 'pending' &&
          (profile.pending_role === 'case_manager' || profile.pending_role === 'coordinator'),
      ),
    [profiles],
  )

  if (activeModule) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveModule(null)}
          className="inline-flex items-center gap-2 text-sm text-info"
        >
          <ArrowLeft className="h-4 w-4" />
          Consola Super Admin
        </button>

        {error && <p className="text-sm text-critical">{error}</p>}

        {activeModule === 'users' && (
          <UserManagementPanel
            profiles={profiles}
            sites={sites}
            coordinatorByUserId={coordinatorByUserId}
            coordinatorBySiteId={coordinatorBySiteId}
            currentUserId={user?.id}
            busyId={busyId}
            onPromoteAdmin={promoteAdmin}
            onPromoteCaseManager={promoteCaseManager}
            onPromoteCoordinator={promoteCoordinator}
            onUserAction={handleUserAction}
          />
        )}

        {activeModule === 'requests' && (
          <RequestsModule
            rows={pendingRequests.data ?? []}
            roleRows={pendingNetworkRequests}
            loading={pendingRequests.isLoading}
            assignments={requestAssignments}
            onAssign={(requestId, siteId) =>
              setRequestAssignments((prev) => ({ ...prev, [requestId]: siteId }))
            }
            busyId={busyId}
            onApprove={async (request) => {
              const siteId = requestAssignments[request.id] || request.requested_site_id
              if (!siteId || !request.requested_site_type) {
                setError('Selecciona un centro antes de aprobar.')
                return
              }
              setBusyId(request.id)
              try {
                await requestMutations.approve.mutateAsync({
                  requestId: request.id,
                  assignedSiteType: request.requested_site_type,
                  assignedSiteId: siteId,
                })
                await pendingRequests.refetch()
                await refetchProfiles()
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onReject={async (requestId) => {
              setBusyId(requestId)
              try {
                await requestMutations.reject.mutateAsync({ requestId })
                await pendingRequests.refetch()
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onApproveRole={async (userId, reviewNotes) => {
              setBusyId(userId)
              try {
                await authService.reviewNetworkRoleRequest(userId, true, reviewNotes)
                await refetchProfiles()
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onRejectRole={async (userId, reviewNotes) => {
              setBusyId(userId)
              try {
                await authService.reviewNetworkRoleRequest(userId, false, reviewNotes)
                await refetchProfiles()
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onRequestRoleInfo={async (userId, message) => {
              setBusyId(userId)
              try {
                await authService.requestNetworkRoleInfo(userId, message)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'coordinators' && (
          <CoordinatorsModule
            rows={coordinators.data ?? []}
            loading={coordinators.isLoading}
            busyId={busyId}
            onRemove={async (profileId) => {
              setBusyId(profileId)
              try {
                await mutations.removeCoordinator.mutateAsync(profileId)
                await coordinators.refetch()
                await refetchProfiles()
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {(activeModule === 'hospitals' || activeModule === 'shelters' || activeModule === 'supply_centers') && (
          <SitesModule
            siteType={mapModuleToSiteType(activeModule)}
            rows={(registry.data ?? []).filter((r) => r.site_type === mapModuleToSiteType(activeModule))}
            loading={registry.isLoading}
            busyId={busyId}
            onCreate={() => setShowCreateCenter(true)}
            onDelete={async (siteType, siteId) => {
              setBusyId(siteId)
              try {
                await mutations.deleteSite.mutateAsync({ siteType, siteId })
                await registry.refetch()
                invalidateSitesCache(queryClient)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo eliminar'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'needs' && (
          <NeedsModule
            rows={needs.data ?? []}
            sites={sites}
            loading={needs.isLoading}
            busyId={busyId}
            onCreate={async (input) => {
              setBusyId('create-need')
              try {
                await mutations.createNeed.mutateAsync(input)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onMarkCovered={async (id) => {
              setBusyId(id)
              try {
                await mutations.markNeedCovered.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onDelete={async (id) => {
              if (!window.confirm('¿Eliminar esta necesidad de centro?')) return
              setBusyId(id)
              setError(null)
              try {
                await mutations.deleteNeed.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'public_needs' && (
          <PublicNeedsModule
            rows={publicNeeds.data ?? []}
            loading={publicNeeds.isLoading}
            busyId={busyId}
            onDelete={async (id) => {
              if (!window.confirm('¿Eliminar esta necesidad pública del radar? No se puede deshacer.')) return
              setBusyId(id)
              setError(null)
              try {
                await mutations.deletePublicNeed.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'inventory' && <InventoryModule rows={needs.data ?? []} loading={needs.isLoading} />}

        {activeModule === 'reports' && (
          <ReportsModule
            rows={reports.data ?? []}
            loading={reports.isLoading}
            busyId={busyId}
            onReview={async (id, status) => {
              setBusyId(id)
              try {
                await mutations.reviewReport.mutateAsync({ id, status })
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onRestore={async (id) => {
              setBusyId(id)
              try {
                await mutations.restoreReport.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
            onDeletePermanent={async (id) => {
              setBusyId(id)
              try {
                await mutations.deleteReport.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'events' && (
          <EventsModule
            rows={events.data ?? []}
            loading={events.isLoading}
            busyId={busyId}
            onDelete={async (id) => {
              setBusyId(id)
              try {
                await mutations.deleteEvent.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'dev_reset' && (
          <DevResetModule
            confirmText={devResetConfirm}
            onConfirmTextChange={setDevResetConfirm}
            busy={mutations.resetOperationalData.isPending}
            onReset={async () => {
              setError(null)
              try {
                await mutations.resetOperationalData.mutateAsync('vicentejmn80@gmail.com')
                setDevResetConfirm('')
                await refetchProfiles()
                invalidateSitesCache(queryClient)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              }
            }}
          />
        )}

        {activeModule === 'maintenance' && (
          <MaintenanceModule
            busy={mutations.runMaintenanceAction.isPending}
            message={maintenanceMessage}
            onRun={async (action, label) => {
              if (!window.confirm(`¿Confirmas ejecutar: ${label}?`)) return

              setError(null)
              setMaintenanceMessage(null)
              try {
                const result = await mutations.runMaintenanceAction.mutateAsync(action)
                setMaintenanceMessage(`${label}: ${result.affected} registro(s) procesados.`)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              }
            }}
          />
        )}

        {activeModule === 'notifications' && (
          <NotificationsModule
            rows={notifications.data ?? []}
            loading={notifications.isLoading}
            busyId={busyId}
            onDelete={async (id) => {
              setBusyId(id)
              try {
                await mutations.deleteNotification.mutateAsync(id)
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              } finally {
                setBusyId(null)
              }
            }}
          />
        )}

        {activeModule === 'operational_settings' && (
          <OperationalSettingsModule
            settings={operationalSettings.data}
            loading={operationalSettings.isLoading}
            busy={mutations.updateOperationalSetting.isPending}
            onSave={async (value) => {
              setError(null)
              try {
                await mutations.updateOperationalSetting.mutateAsync({
                  key: 'need_cycle_duration_hours',
                  value,
                })
              } catch (err) {
                setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
              }
            }}
          />
        )}

        {activeModule === 'audit' && (
          <section className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Auditoría</p>
            <AuditTimeline entries={auditTimeline.entries} loading={auditTimeline.isLoading} />
          </section>
        )}

        {activeModule === 'lab' && (
          <DevWorkspace
            simulatedRole={simulatedRole}
            onSimulate={setSimulatedRole}
            onStopSimulation={() => setSimulatedRole(null)}
          />
        )}

        {showCreateCenter && (
          <CreateCenterWizard
            onClose={() => setShowCreateCenter(false)}
            onSuccess={async () => {
              setShowCreateCenter(false)
              await registry.refetch()
              invalidateSitesCache(queryClient)
            }}
          />
        )}

        {editProfile && (
          <FlowSheet
            title="Editar perfil"
            subtitle={editProfile.email}
            onClose={() => setEditProfile(null)}
          >
            <div className="space-y-3 px-5 pb-8">
              <label className="block space-y-1">
                <span className="text-xs text-ink-subtle">Nombre</span>
                <input className={fieldClassName} value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink-subtle">Teléfono</span>
                <input className={fieldClassName} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </label>
              <EmergencyButton
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busyId === editProfile.id}
                onClick={async () => {
                  setBusyId(editProfile.id)
                  try {
                    await mutations.updateProfile.mutateAsync({
                      userId: editProfile.id,
                      fullName: editFullName,
                      phone: editPhone,
                    })
                    setEditProfile(null)
                    await refetchProfiles()
                  } catch (err) {
                    setError(formatAuthError(err instanceof Error ? err.message : 'Error'))
                  } finally {
                    setBusyId(null)
                  }
                }}
              >
                Guardar cambios
              </EmergencyButton>
            </div>
          </FlowSheet>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <GlassCard className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-info" />
        <div>
          <p className="text-sm font-medium text-ink">Consola Super Admin</p>
          <p className="text-xs text-ink-subtle">Administración integral de FARO sin acceder a Supabase.</p>
        </div>
      </GlassCard>

      {error && <p className="text-sm text-critical">{error}</p>}

      <SystemHealthPanel />

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODULES.map((mod) => {
          const Icon = mod.icon
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveModule(mod.id)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                  <Icon className="h-5 w-5 text-info" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{mod.label}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{mod.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </section>
    </div>
  )
}

function mapModuleToSiteType(module: SuperAdminModuleId): 'hospital' | 'shelter' | 'supply_center' {
  if (module === 'hospitals') return 'hospital'
  if (module === 'shelters') return 'shelter'
  return 'supply_center'
}

function CoordinatorsModule({
  rows,
  loading,
  busyId,
  onRemove,
}: {
  rows: AdminCoordinatorRow[]
  loading: boolean
  busyId: string | null
  onRemove: (profileId: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando coordinadores…</p>
  if (rows.length === 0) return <EmptyState icon={UserCog} title="Sin coordinadores asignados" />

  return (
    <section className="space-y-2">
      {rows.map((row) => (
        <GlassCard key={row.profile_id} className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{row.full_name || row.email}</p>
              <p className="text-xs text-ink-subtle">{row.email}</p>
              <p className="mt-1 text-xs text-info">
                {row.site_name ?? 'Sin centro'} · {label(SITE_TYPE_LABELS, row.site_type, row.site_type ?? '')}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-ink-muted">{row.user_status}</span>
          </div>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="w-full text-critical"
            disabled={busyId === row.profile_id}
            onClick={() => void onRemove(row.profile_id)}
          >
            Quitar coordinador
          </EmergencyButton>
        </GlassCard>
      ))}
    </section>
  )
}

function SitesModule({
  siteType,
  rows,
  loading,
  busyId,
  onCreate,
  onDelete,
}: {
  siteType: 'hospital' | 'shelter' | 'supply_center'
  rows: AdminRegistryRow[]
  loading: boolean
  busyId: string | null
  onCreate: () => void
  onDelete: (siteType: 'hospital' | 'shelter' | 'supply_center', siteId: string) => Promise<void>
}) {
  const label = siteType === 'hospital' ? 'hospital' : siteType === 'shelter' ? 'refugio' : 'acopio'

  return (
    <section className="space-y-3">
      <EmergencyButton variant="primary" size="sm" className="w-full" onClick={onCreate}>
        <Building2 className="h-4 w-4" />
        Registrar {label}
      </EmergencyButton>
      {loading && <p className="text-sm text-ink-subtle">Cargando…</p>}
      {!loading && rows.length === 0 && <EmptyState icon={Building2} title={`Sin ${label}s registrados`} />}
      {rows.map((row) => (
        <GlassCard key={row.site_id} className="space-y-2">
          <div>
            <p className="text-sm font-medium text-ink">{row.site_name}</p>
            <p className="text-xs text-ink-subtle">{row.site_address ?? 'Sin dirección'}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Coordinador: {row.coordinator_name ?? (row.is_orphan ? 'Huérfano' : '—')}
            </p>
          </div>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="w-full text-critical"
            disabled={busyId === row.site_id}
            onClick={() => void onDelete(siteType, row.site_id)}
          >
            Eliminar {label}
          </EmergencyButton>
        </GlassCard>
      ))}
    </section>
  )
}

function PublicNeedsModule({
  rows,
  loading,
  busyId,
  onDelete,
}: {
  rows: Array<{
    id: string
    title: string
    summary: string | null
    category: string | null
    priority: string
    status: string
    visibility_status: string
    location_public: { lat?: number; lng?: number; zone?: string; address?: string } | null
    created_at: string
  }>
  loading: boolean
  busyId: string | null
  onDelete: (id: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando necesidades públicas…</p>
  if (rows.length === 0) return <EmptyState icon={Flag} title="Sin necesidades públicas" />

  return (
    <section className="space-y-3">
      <p className="text-xs text-ink-subtle">
        Estas son las necesidades que ven los voluntarios en el radar y en la pestaña Necesidades.
      </p>
      {rows.map((need) => (
        <GlassCard key={need.id} className="space-y-2">
          <div>
            <p className="text-sm font-medium text-ink">{need.title}</p>
            <p className="text-xs text-ink-subtle line-clamp-2">{need.summary ?? 'Sin resumen'}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {label(PRIORITY_LABELS, need.priority, need.priority)} · {need.status} ·{' '}
              {need.visibility_status}
              {need.location_public?.zone ? ` · ${need.location_public.zone}` : ''}
            </p>
          </div>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="w-full text-critical"
            disabled={busyId === need.id}
            onClick={() => void onDelete(need.id)}
          >
            Eliminar del radar
          </EmergencyButton>
        </GlassCard>
      ))}
    </section>
  )
}

function NeedsModule({
  rows,
  sites,
  loading,
  busyId,
  onCreate,
  onMarkCovered,
  onDelete,
}: {
  rows: Need[]
  sites: Site[]
  loading: boolean
  busyId: string | null
  onCreate: (input: {
    needableType: 'hospital' | 'shelter' | 'supply_center'
    needableId: string
    itemName: string
    priority: string
    qtyRequired: number
  }) => Promise<void>
  onMarkCovered: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [itemName, setItemName] = useState('')
  const [siteId, setSiteId] = useState('')
  const registeredSites = sites.filter((s) => s.type !== 'organization')

  if (loading) return <p className="text-sm text-ink-subtle">Cargando necesidades…</p>

  return (
    <section className="space-y-3">
      <GlassCard className="space-y-2">
        <p className="text-sm font-medium text-ink">Crear necesidad</p>
        <input
          className={fieldClassName}
          placeholder="Nombre del ítem"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <select className={fieldClassName} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">Seleccionar centro</option>
          {registeredSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <EmergencyButton
          variant="primary"
          size="sm"
          className="w-full"
          disabled={!itemName.trim() || !siteId || busyId === 'create-need'}
          onClick={() => {
            const site = registeredSites.find((s) => s.id === siteId)
            if (!site || site.type === 'organization') return
            void onCreate({
              needableType: siteToNeedableType(site),
              needableId: siteId,
              itemName: itemName.trim(),
              priority: 'medium',
              qtyRequired: 1,
            }).then(() => {
              setItemName('')
              setSiteId('')
            })
          }}
        >
          Crear
        </EmergencyButton>
      </GlassCard>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin necesidades" />
      ) : (
        rows.slice(0, 100).map((need) => (
          <GlassCard key={need.id} className="space-y-2">
            <div>
              <NeedItemLabel name={need.type} className="text-sm font-medium text-ink" />
              <p className="text-xs text-ink-subtle">
                Prioridad {label(PRIORITY_LABELS, need.priority, need.priority)} · {need.available}/{need.required}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EmergencyButton
                variant="glass"
                size="sm"
                disabled={busyId === need.id}
                onClick={() => void onMarkCovered(need.id)}
              >
                Marcar cubierta
              </EmergencyButton>
              <EmergencyButton
                variant="glass"
                size="sm"
                className="text-critical"
                disabled={busyId === need.id}
                onClick={() => void onDelete(need.id)}
              >
                Eliminar
              </EmergencyButton>
            </div>
          </GlassCard>
        ))
      )}
    </section>
  )
}

function InventoryModule({ rows, loading }: { rows: Need[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando inventario…</p>
  const lowStock = rows.filter((n) => n.available < n.required)

  return (
    <section className="space-y-2">
      <GlassCard className="bg-white/[0.03]">
        <p className="text-sm text-ink-muted">
          {lowStock.length} ítems con cobertura incompleta de {rows.length} totales.
        </p>
      </GlassCard>
      {lowStock.slice(0, 50).map((need) => {
        const pct = need.required > 0 ? Math.round((need.available / need.required) * 100) : 0
        return (
          <GlassCard key={need.id}>
            <NeedItemLabel name={need.type} className="text-sm font-medium text-ink" />
            <p className="text-xs text-ink-subtle">
              Stock: {need.available}/{need.required} ({pct}%)
            </p>
          </GlassCard>
        )
      })}
    </section>
  )
}

function ReportsModule({
  rows,
  loading,
  busyId,
  onReview,
  onRestore,
  onDeletePermanent,
}: {
  rows: Report[]
  loading: boolean
  busyId: string | null
  onReview: (id: string, status: 'verified' | 'dismissed') => Promise<void>
  onRestore: (id: string) => Promise<void>
  onDeletePermanent: (id: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando reportes…</p>
  if (rows.length === 0) return <EmptyState icon={ScrollText} title="Sin reportes" />

  return (
    <section className="space-y-2">
      {rows.slice(0, 80).map((report) => (
        <GlassCard key={report.id} className="space-y-2">
          <p className="line-clamp-3 text-sm text-ink">{report.description}</p>
          <p className="text-xs text-ink-subtle">
            {label(REPORT_STATUS_LABELS, report.status, report.status)} · {report.createdAt.toLocaleString('es-VE')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {report.status === 'new' && (
              <>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  disabled={busyId === report.id}
                  onClick={() => void onReview(report.id, 'verified')}
                >
                  Verificar
                </EmergencyButton>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  disabled={busyId === report.id}
                  onClick={() => void onReview(report.id, 'dismissed')}
                >
                  Descartar
                </EmergencyButton>
              </>
            )}
            {report.status !== 'new' && (
              <EmergencyButton
                variant="glass"
                size="sm"
                className="col-span-2"
                disabled={busyId === report.id}
                onClick={() => void onRestore(report.id)}
              >
                Restaurar a pendiente
              </EmergencyButton>
            )}
            <EmergencyButton
              variant="glass"
              size="sm"
              className="col-span-2 text-critical"
              disabled={busyId === report.id}
              onClick={() => void onDeletePermanent(report.id)}
            >
              Eliminar definitivamente
            </EmergencyButton>
          </div>
        </GlassCard>
      ))}
    </section>
  )
}

function RequestsModule({
  rows,
  roleRows,
  loading,
  assignments,
  onAssign,
  busyId,
  onApprove,
  onReject,
  onApproveRole,
  onRejectRole,
  onRequestRoleInfo,
}: {
  rows: CoordinatorRequestRow[]
  roleRows: ProfileRow[]
  loading: boolean
  assignments: Record<string, string>
  onAssign: (requestId: string, siteId: string) => void
  busyId: string | null
  onApprove: (request: CoordinatorRequestRow) => Promise<void>
  onReject: (requestId: string) => Promise<void>
  onApproveRole: (userId: string, reviewNotes?: string) => Promise<void>
  onRejectRole: (userId: string, reviewNotes?: string) => Promise<void>
  onRequestRoleInfo: (userId: string, message: string) => Promise<void>
}) {
  const [notesByUser, setNotesByUser] = useState<Record<string, string>>({})
  const [infoByUser, setInfoByUser] = useState<Record<string, string>>({})

  if (loading) return <p className="text-sm text-ink-subtle">Cargando solicitudes…</p>
  if (rows.length === 0 && roleRows.length === 0) {
    return <EmptyState icon={FileQuestion} title="Sin solicitudes pendientes" />
  }

  return (
    <section className="space-y-3">
      {roleRows.length > 0 && (
        <>
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Solicitudes de rol (Gestor/Coordinador)
          </p>
          {roleRows.map((profile) => {
            const requestedRole = profile.pending_role
            const notes = notesByUser[profile.id] ?? ''
            const infoMessage = infoByUser[profile.id] ?? ''
            return (
              <GlassCard key={profile.id} className="space-y-2">
                <p className="text-sm font-medium text-ink">{profile.full_name || profile.email}</p>
                <p className="text-xs text-ink-subtle">{profile.email}</p>
                <p className="text-xs text-info">
                  Solicita: {requestedRole === 'case_manager' ? 'Gestor de Casos' : 'Coordinador'}
                </p>
                {profile.role_request_reason && (
                  <p className="text-xs text-ink-muted">{profile.role_request_reason}</p>
                )}
                <textarea
                  className={fieldClassName}
                  placeholder="Notas de revisión (opcional)"
                  value={notes}
                  onChange={(e) =>
                    setNotesByUser((prev) => ({
                      ...prev,
                      [profile.id]: e.target.value,
                    }))
                  }
                />
                <textarea
                  className={fieldClassName}
                  placeholder="Pedir más info (mensaje opcional)"
                  value={infoMessage}
                  onChange={(e) =>
                    setInfoByUser((prev) => ({
                      ...prev,
                      [profile.id]: e.target.value,
                    }))
                  }
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="w-full"
                    disabled={busyId === profile.id || !infoMessage.trim()}
                    onClick={() => void onRequestRoleInfo(profile.id, infoMessage.trim())}
                  >
                    Pedir más info
                  </EmergencyButton>
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="w-full text-critical"
                    disabled={busyId === profile.id}
                    onClick={() => void onRejectRole(profile.id, notes || undefined)}
                  >
                    Rechazar
                  </EmergencyButton>
                  <EmergencyButton
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={busyId === profile.id}
                    onClick={() => void onApproveRole(profile.id, notes || undefined)}
                  >
                    Aprobar
                  </EmergencyButton>
                </div>
              </GlassCard>
            )
          })}
        </>
      )}

      {rows.length > 0 && (
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Solicitudes de coordinador por centro
        </p>
      )}
      {rows.map((request) => (
        <CoordinatorRequestReview
          key={request.id}
          request={request}
          assignedSiteId={assignments[request.id] ?? request.requested_site_id ?? ''}
          onAssignedSiteChange={(siteId) => onAssign(request.id, siteId)}
          onApprove={() => void onApprove(request)}
          onReject={() => void onReject(request.id)}
          onRequestInfo={() => undefined}
          busy={busyId === request.id}
        />
      ))}
    </section>
  )
}

function EventsModule({
  rows,
  loading,
  busyId,
  onDelete,
}: {
  rows: Event[]
  loading: boolean
  busyId: string | null
  onDelete: (id: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando eventos…</p>
  if (rows.length === 0) return <EmptyState icon={Calendar} title="Sin eventos" />

  return (
    <section className="space-y-2">
      {rows.slice(0, 80).map((event) => (
        <GlassCard key={event.id} className="space-y-2">
          <p className="text-sm font-medium text-ink">{event.title}</p>
          <p className="text-xs text-ink-subtle">{event.createdAt.toLocaleString('es-VE')}</p>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="w-full text-critical"
            disabled={busyId === event.id}
            onClick={() => void onDelete(event.id)}
          >
            Eliminar
          </EmergencyButton>
        </GlassCard>
      ))}
    </section>
  )
}

function DevResetModule({
  confirmText,
  onConfirmTextChange,
  busy,
  onReset,
}: {
  confirmText: string
  onConfirmTextChange: (v: string) => void
  busy: boolean
  onReset: () => Promise<void>
}) {
  return (
    <GlassCard className="space-y-3 border-critical/30">
      <p className="text-sm font-medium text-critical">Limpieza operacional (desarrollo)</p>
      <p className="text-sm text-ink-muted">
        Elimina reportes, necesidades, centros, usuarios de prueba y logs. Conserva{' '}
        <strong>vicentejmn80@gmail.com</strong> como super_admin.
      </p>
      <input
        className={fieldClassName}
        placeholder='Escribe BORRAR para confirmar'
        value={confirmText}
        onChange={(e) => onConfirmTextChange(e.target.value)}
      />
      <EmergencyButton
        variant="primary"
        size="lg"
        className="w-full bg-critical"
        disabled={busy || confirmText.trim().toUpperCase() !== 'BORRAR'}
        onClick={() => void onReset()}
      >
        Ejecutar limpieza
      </EmergencyButton>
    </GlassCard>
  )
}

function MaintenanceModule({
  busy,
  message,
  onRun,
}: {
  busy: boolean
  message: string | null
  onRun: (
    action:
      | 'archive_covered_needs'
      | 'clean_dismissed_reports'
      | 'delete_test_data'
      | 'reset_dashboard'
      | 'clean_old_events'
      | 'delete_closed_needs'
      | 'clean_old_notifications',
    label: string,
  ) => Promise<void>
}) {
  const actions: Array<{
    id:
      | 'archive_covered_needs'
      | 'clean_dismissed_reports'
      | 'delete_test_data'
      | 'reset_dashboard'
      | 'clean_old_events'
      | 'delete_closed_needs'
      | 'clean_old_notifications'
    label: string
    description: string
  }> = [
    {
      id: 'archive_covered_needs',
      label: 'Archivar necesidades cubiertas',
      description: 'Retira del panel necesidades con cobertura >= 100%.',
    },
    {
      id: 'clean_dismissed_reports',
      label: 'Limpiar reportes descartados',
      description: 'Elimina reportes en estado dismissed.',
    },
    {
      id: 'delete_test_data',
      label: 'Eliminar datos de prueba',
      description: 'Borra registros con texto test/prueba/demo.',
    },
    {
      id: 'reset_dashboard',
      label: 'Reiniciar dashboard',
      description: 'Limpieza rapida de datos historicos no operativos.',
    },
    {
      id: 'clean_old_events',
      label: 'Limpiar eventos antiguos',
      description: 'Borra eventos de mas de 14 dias.',
    },
    {
      id: 'delete_closed_needs',
      label: 'Eliminar necesidades cerradas',
      description: 'Borra necesidades cubiertas o con objetivo en cero.',
    },
    {
      id: 'clean_old_notifications',
      label: 'Limpiar notificaciones antiguas',
      description: 'Borra notificaciones leidas o antiguas.',
    },
  ]

  return (
    <section className="space-y-2">
      {message && <p className="text-xs text-operational">{message}</p>}
      {actions.map((action) => (
        <GlassCard key={action.id} className="space-y-2">
          <p className="text-sm font-medium text-ink">{action.label}</p>
          <p className="text-xs text-ink-subtle">{action.description}</p>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => void onRun(action.id, action.label)}
          >
            Ejecutar con confirmacion
          </EmergencyButton>
        </GlassCard>
      ))}
    </section>
  )
}

function OperationalSettingsModule({
  settings,
  loading,
  busy,
  onSave,
}: {
  settings: { needCycleDurationHours: number } | undefined
  loading: boolean
  busy: boolean
  onSave: (value: number) => Promise<void>
}) {
  const [value, setValue] = useState(String(settings?.needCycleDurationHours ?? 24))

  useEffect(() => {
    if (settings?.needCycleDurationHours) {
      setValue(String(settings.needCycleDurationHours))
    }
  }, [settings?.needCycleDurationHours])

  if (loading) return <p className="text-sm text-ink-subtle">Cargando configuración…</p>

  return (
    <section className="space-y-3">
      <GlassCard className="space-y-3">
        <p className="text-sm font-medium text-ink">Duración del Ciclo Operativo</p>
        <p className="text-xs text-ink-subtle">
          Define cuántas horas permanece activa una necesidad antes de exigir cierre de ciclo.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {['12', '24', '36', '48', '72'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setValue(opt)}
              className={
                value === opt
                  ? 'rounded-2xl border border-info/60 bg-info-soft px-3 py-2 text-xs text-ink'
                  : 'rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink-muted'
              }
            >
              {opt} h
            </button>
          ))}
        </div>
        <label className="block text-xs text-ink-subtle">
          Valor personalizado (horas)
          <input
            type="number"
            min={1}
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={busy || !Number(value)}
          onClick={() => void onSave(Number(value))}
        >
          Guardar configuración
        </EmergencyButton>
      </GlassCard>
    </section>
  )
}

function NotificationsModule({
  rows,
  loading,
  busyId,
  onDelete,
}: {
  rows: Array<{ id: string; title: string; body: string; type: string; read: boolean; created_at: string }>
  loading: boolean
  busyId: string | null
  onDelete: (id: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando notificaciones…</p>
  if (rows.length === 0) return <EmptyState icon={Bell} title="Sin notificaciones" />

  return (
    <section className="space-y-2">
      {rows.map((n) => (
        <GlassCard key={n.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink">{n.title}</p>
              <p className="line-clamp-2 text-xs text-ink-subtle">{n.body}</p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {label(NOTIFICATION_TYPE_LABELS, n.type, n.type)} · {new Date(n.created_at).toLocaleString('es-VE')}
              </p>
            </div>
            {!n.read && <span className="rounded-full bg-info/20 px-2 py-0.5 text-[10px] text-info">Nueva</span>}
          </div>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="w-full text-critical"
            disabled={busyId === n.id}
            onClick={() => void onDelete(n.id)}
          >
            Eliminar
          </EmergencyButton>
        </GlassCard>
      ))}
    </section>
  )
}
