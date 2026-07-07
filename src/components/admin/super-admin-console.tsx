import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Building2,
  ClipboardList,
  HeartPulse,
  Home,
  Package,
  ScrollText,
  Shield,
  Users,
  UserCog,
  Warehouse,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { SystemHealthPanel } from '@/components/admin/system-health-panel'
import { UserManagementPanel } from '@/components/admin/user-management-panel'
import { CreateCenterWizard } from '@/components/admin/create-center-wizard'
import { useAdminProfiles } from '@/hooks/useAuthRequests'
import { useAuditTimeline } from '@/hooks/useAuditTimeline'
import {
  useAdminCoordinators,
  useAdminMutations,
  useAdminNeeds,
  useAdminNotificationsList,
  useAdminRegistry,
  useAdminReports,
} from '@/hooks/useAdminConsole'
import type { AdminCoordinatorRow, AdminRegistryRow, SuperAdminModuleId } from '@/lib/admin-types'
import { authService } from '@/services/auth-service'
import { formatAuthError } from '@/lib/auth-errors'
import { useAuth } from '@/store/auth-context'
import { useFaro } from '@/store/faro-context'
import { siteToNeedableType } from '@/lib/site-utils'
import type { ProfileRow } from '@/repositories/auth-types'
import type { Need, Report } from '@/domain/models'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

function invalidateSitesCache(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centers] })
  void queryClient.invalidateQueries({ queryKey: ['sites-registry'] })
  void queryClient.invalidateQueries({ queryKey: ['anchor-sites'] })
}

const MODULES: { id: SuperAdminModuleId; label: string; icon: typeof Users; description: string }[] = [
  { id: 'users', label: 'Usuarios', icon: Users, description: 'Roles, estado y perfiles' },
  { id: 'coordinators', label: 'Coordinadores', icon: UserCog, description: 'Asignaciones y centros' },
  { id: 'hospitals', label: 'Hospitales', icon: HeartPulse, description: 'Registro y mantenimiento' },
  { id: 'shelters', label: 'Refugios', icon: Home, description: 'Registro y mantenimiento' },
  { id: 'supply_centers', label: 'Acopios', icon: Warehouse, description: 'Centros de acopio' },
  { id: 'needs', label: 'Necesidades', icon: ClipboardList, description: 'CRUD global' },
  { id: 'reports', label: 'Reportes', icon: ScrollText, description: 'Moderación ciudadana' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, description: 'Bandeja del sistema' },
  { id: 'inventory', label: 'Inventario', icon: Package, description: 'Stock por centro' },
  { id: 'audit', label: 'Auditoría', icon: Shield, description: 'Eventos auth y operativos' },
]

export function SuperAdminConsole() {
  const [activeModule, setActiveModule] = useState<SuperAdminModuleId | null>(null)
  const { user, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const { sites } = useFaro()
  const enabled = true
  const { data: profiles = [], refetch: refetchProfiles } = useAdminProfiles(enabled)
  const auditTimeline = useAuditTimeline(enabled)
  const registry = useAdminRegistry(enabled)
  const coordinators = useAdminCoordinators(enabled)
  const needs = useAdminNeeds(enabled)
  const reports = useAdminReports(enabled)
  const notifications = useAdminNotificationsList(enabled)
  const mutations = useAdminMutations()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreateCenter, setShowCreateCenter] = useState(false)

  const coordinatorByUserId = useMemo(() => {
    const map = new Map<string, AdminCoordinatorRow>()
    for (const row of coordinators.data ?? []) {
      map.set(row.auth_user_id, row)
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

  async function handleUserAction(action: string, profile: ProfileRow) {
    setBusyId(profile.id)
    setError(null)
    try {
      if (action === 'suspend') {
        await mutations.updateUserStatus.mutateAsync({ userId: profile.id, status: 'suspended' })
      } else if (action === 'activate') {
        await mutations.updateUserStatus.mutateAsync({ userId: profile.id, status: 'active' })
      } else if (action === 'revoke-coordinator' || action === 'demote') {
        await mutations.revokeCoordinatorRole.mutateAsync(profile.id)
      }
      await refetchProfiles()
      await refreshProfile()
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'Operación fallida'))
    } finally {
      setBusyId(null)
    }
  }

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
            currentUserId={user?.id}
            busyId={busyId}
            onPromoteAdmin={promoteAdmin}
            onPromoteCoordinator={promoteCoordinator}
            onUserAction={handleUserAction}
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
            loading={needs.isLoading}
            busyId={busyId}
            onDelete={async (id) => {
              setBusyId(id)
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

        {activeModule === 'audit' && (
          <section className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Auditoría</p>
            <AuditTimeline entries={auditTimeline.entries} loading={auditTimeline.isLoading} />
          </section>
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
                {row.site_name ?? 'Sin centro'} · {row.site_type}
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

function NeedsModule({
  rows,
  loading,
  busyId,
  onDelete,
}: {
  rows: Need[]
  loading: boolean
  busyId: string | null
  onDelete: (id: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando necesidades…</p>
  if (rows.length === 0) return <EmptyState icon={ClipboardList} title="Sin necesidades" />

  return (
    <section className="space-y-2">
      {rows.slice(0, 100).map((need) => (
        <GlassCard key={need.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{need.type}</p>
            <p className="text-xs text-ink-subtle">
              Prioridad {need.priority} · {need.available}/{need.required}
            </p>
          </div>
          <EmergencyButton
            variant="glass"
            size="sm"
            className="shrink-0 text-critical"
            disabled={busyId === need.id}
            onClick={() => void onDelete(need.id)}
          >
            Eliminar
          </EmergencyButton>
        </GlassCard>
      ))}
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
            <p className="text-sm font-medium text-ink">{need.type}</p>
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
}: {
  rows: Report[]
  loading: boolean
  busyId: string | null
  onReview: (id: string, status: 'verified' | 'dismissed') => Promise<void>
  onRestore: (id: string) => Promise<void>
}) {
  if (loading) return <p className="text-sm text-ink-subtle">Cargando reportes…</p>
  if (rows.length === 0) return <EmptyState icon={ScrollText} title="Sin reportes" />

  return (
    <section className="space-y-2">
      {rows.slice(0, 80).map((report) => (
        <GlassCard key={report.id} className="space-y-2">
          <p className="line-clamp-3 text-sm text-ink">{report.description}</p>
          <p className="text-xs text-ink-subtle">
            {report.status} · {report.createdAt.toLocaleString('es-VE')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {report.status === 'new' ? (
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
                  className="text-critical"
                  disabled={busyId === report.id}
                  onClick={() => void onReview(report.id, 'dismissed')}
                >
                  Descartar
                </EmergencyButton>
              </>
            ) : (
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
          </div>
        </GlassCard>
      ))}
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
                {n.type} · {new Date(n.created_at).toLocaleString('es-VE')}
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
