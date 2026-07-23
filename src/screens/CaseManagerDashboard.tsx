import { useEffect, useMemo, useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { CaseManagerHeader } from '@/components/case-manager/CaseManagerHeader'
import { CaseSummaryCards } from '@/components/case-manager/CaseSummaryCards'
import { PriorityCasesList } from '@/components/case-manager/PriorityCasesList'
import { AllCasesList } from '@/components/case-manager/AllCasesList'
import { CaseQuickActions } from '@/components/case-manager/CaseQuickActions'
import { RecentActivity } from '@/components/case-manager/RecentActivity'
import { CaseValidationModal } from '@/components/case-manager/CaseValidationModal'
import { useAuth } from '@/store/auth-context'
import { useMapData } from '@/hooks/useMapData'
import { useFaro } from '@/store/faro-context'
import { timeAgo } from '@/lib/utils'
import type { TabId } from '@/components/faro/app-navigation'
import type {
  CaseActivityItem,
  CaseFilterItem,
  CaseListFilter,
  CaseRecord,
  CaseSummaryFilter,
  CaseSummaryItem,
} from '@/types/case.types'
import { CaseDetailScreen } from './CaseDetailScreen'
import { CaseValidationScreen } from './CaseValidationScreen'
import {
  navigateCaseManager,
  parseCaseManagerHash,
  type CaseManagerRoute,
} from '@/routes/case-manager.routes'

interface CaseManagerDashboardProps {
  onNavigate: (tab: TabId) => void
  onOpenNotifications: () => void
  notificationCount: number
}

const MOCK_CASES: CaseRecord[] = [
  {
    id: 'C-2026-104',
    title: 'Familia sin techo',
    priority: 'high',
    location: 'Col. Lomas',
    reportedBy: 'Ana R.',
    reportedAt: new Date(Date.now() - 1000 * 60 * 40),
    status: 'review',
    description: 'Familia reporta pérdida total de vivienda y solicita refugio temporal.',
    contactPhone: '+58 412 000 0104',
    assignedTo: 'Centro La Esperanza',
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    updatedAt: new Date(Date.now() - 1000 * 60 * 20),
  },
  {
    id: 'C-2026-105',
    title: 'Fuga de agua',
    priority: 'medium',
    location: 'Col. Cerrito',
    reportedBy: 'Pedro M.',
    reportedAt: new Date(Date.now() - 1000 * 60 * 60),
    status: 'waiting',
    description: 'Se reporta fuga en la zona norte, posible afectación a viviendas cercanas.',
    contactPhone: '+58 412 000 0105',
    assignedTo: 'Equipo Infraestructura',
    createdAt: new Date(Date.now() - 1000 * 60 * 70),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: 'C-2026-106',
    title: 'Adulto mayor aislado',
    priority: 'high',
    location: 'Barrio Central',
    reportedBy: 'María J.',
    reportedAt: new Date(Date.now() - 1000 * 60 * 90),
    status: 'followup',
    description: 'Persona mayor sin contacto familiar, requiere verificación presencial.',
    contactPhone: '+58 412 000 0106',
    assignedTo: 'Brigada Social',
    createdAt: new Date(Date.now() - 1000 * 60 * 110),
    updatedAt: new Date(Date.now() - 1000 * 60 * 40),
  },
  {
    id: 'C-2026-107',
    title: 'Centro de salud sin insumos',
    priority: 'medium',
    location: 'Zona Norte',
    reportedBy: 'Dr. Lina P.',
    reportedAt: new Date(Date.now() - 1000 * 60 * 150),
    status: 'review',
    description: 'Faltan medicamentos básicos y guantes en el centro de salud comunitario.',
    contactPhone: '+58 412 000 0107',
    createdAt: new Date(Date.now() - 1000 * 60 * 180),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: 'C-2026-108',
    title: 'Familia con niños sin alimentos',
    priority: 'low',
    location: 'Sector El Lago',
    reportedBy: 'Luis G.',
    reportedAt: new Date(Date.now() - 1000 * 60 * 220),
    status: 'resolved',
    description: 'Se entregó paquete alimentario, confirmar seguimiento.',
    contactPhone: '+58 412 000 0108',
    assignedTo: 'Centro El Lago',
    createdAt: new Date(Date.now() - 1000 * 60 * 240),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10),
  },
]

const ASSIGNMENT_OPTIONS = ['Centro La Esperanza', 'Equipo Infraestructura', 'Brigada Social', 'Centro El Lago']

function mapReportStatus(status: string): CaseRecord['status'] {
  if (status === 'verified') return 'followup'
  if (status === 'discarded') return 'waiting'
  return 'review'
}

function mapReportPriority(type: string): CaseRecord['priority'] {
  if (type === 'health' || type === 'shelter') return 'high'
  if (type === 'access') return 'medium'
  return 'low'
}

export function CaseManagerDashboard({
  onNavigate,
  onOpenNotifications,
  notificationCount,
}: CaseManagerDashboardProps) {
  const { user, profile, role } = useAuth()
  const mapData = useMapData({ userRole: role, userId: user?.id })
  const { latestActivity, state } = useFaro()
  const [listFilter, setListFilter] = useState<CaseListFilter>('all')
  const [summaryFilter, setSummaryFilter] = useState<CaseSummaryFilter | null>(null)
  const [validationCase, setValidationCase] = useState<CaseRecord | null>(null)
  const [route, setRoute] = useState<CaseManagerRoute>(
    () => parseCaseManagerHash() ?? { id: 'dashboard' },
  )

  const reportCases = useMemo(() => {
    if (!mapData.cases.length) return []
    return mapData.cases.map((report, index) => ({
      id: report.id,
      title: report.description.split('.').shift() || 'Reporte ciudadano',
      priority: mapReportPriority(report.type),
      location: report.location?.zone || report.location?.address || 'Zona por confirmar',
      reportedBy: report.source || 'Ciudadano',
      reportedAt: report.createdAt,
      status: mapReportStatus(report.status),
      description: report.description,
      contactPhone: `+58 412 000 ${String(index + 110).padStart(3, '0')}`,
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
    }))
  }, [mapData.cases])

  const [caseItems, setCaseItems] = useState<CaseRecord[]>(reportCases.length ? reportCases : MOCK_CASES)

  useEffect(() => {
    if (reportCases.length) {
      setCaseItems(reportCases)
    } else {
      setCaseItems(MOCK_CASES)
    }
  }, [reportCases])

  useEffect(() => {
    const updateRoute = () => {
      const next = parseCaseManagerHash()
      setRoute(next ?? { id: 'dashboard' })
    }
    updateRoute()
    window.addEventListener('faro:case-manager-route', updateRoute)
    window.addEventListener('popstate', updateRoute)
    return () => {
      window.removeEventListener('faro:case-manager-route', updateRoute)
      window.removeEventListener('popstate', updateRoute)
    }
  }, [])

  const pendingCount = caseItems.filter((caseItem) => caseItem.status === 'review').length
  const summaryItems = useMemo<CaseSummaryItem[]>(
    () => [
      {
        id: 'critical',
        label: 'Críticos',
        value: caseItems.filter((caseItem) => caseItem.priority === 'high' && caseItem.status !== 'resolved').length,
        tone: 'critical',
      },
      {
        id: 'assigned',
        label: 'Asignados',
        value: caseItems.filter((caseItem) => Boolean(caseItem.assignedTo)).length,
        tone: 'warning',
      },
      {
        id: 'followup',
        label: 'Seguimiento',
        value: caseItems.filter((caseItem) => caseItem.status === 'followup').length,
        tone: 'info',
      },
      {
        id: 'resolved',
        label: 'Resueltos',
        value: caseItems.filter((caseItem) => caseItem.status === 'resolved').length,
        tone: 'operational',
      },
    ],
    [caseItems],
  )

  const listFilters = useMemo<CaseFilterItem[]>(
    () => [
      { id: 'all', label: 'Todos', count: caseItems.length },
      { id: 'review', label: 'Revisión', count: caseItems.filter((c) => c.status === 'review').length },
      { id: 'waiting', label: 'Espera', count: caseItems.filter((c) => c.status === 'waiting').length },
      { id: 'followup', label: 'Seguimiento', count: caseItems.filter((c) => c.status === 'followup').length },
    ],
    [caseItems],
  )

  const filteredCases = useMemo(() => {
    let items = [...caseItems]
    if (summaryFilter) {
      if (summaryFilter === 'critical') {
        items = items.filter((item) => item.priority === 'high' && item.status !== 'resolved')
      } else if (summaryFilter === 'assigned') {
        items = items.filter((item) => Boolean(item.assignedTo))
      } else if (summaryFilter === 'followup') {
        items = items.filter((item) => item.status === 'followup')
      } else if (summaryFilter === 'resolved') {
        items = items.filter((item) => item.status === 'resolved')
      }
      return items
    }
    if (listFilter === 'all') return items
    return items.filter((item) => item.status === listFilter)
  }, [caseItems, listFilter, summaryFilter])

  const priorityCases = useMemo(() => {
    const order = { high: 3, medium: 2, low: 1 }
    return caseItems
      .filter((caseItem) => caseItem.status !== 'resolved')
      .sort((a, b) => order[b.priority] - order[a.priority])
      .slice(0, 3)
  }, [caseItems])

  const activityItems: CaseActivityItem[] = useMemo(() => {
    if (latestActivity.length) {
      return latestActivity.slice(0, 5).map((event) => ({
        id: event.id,
        description: event.title,
        createdAt: event.at,
      }))
    }
    return [
      {
        id: 'activity-1',
        description: 'Caso #C-2026-104 actualizado por validación telefónica.',
        createdAt: new Date(Date.now() - 1000 * 60 * 25),
      },
      {
        id: 'activity-2',
        description: 'Caso #C-2026-106 asignado a Brigada Social.',
        createdAt: new Date(Date.now() - 1000 * 60 * 120),
      },
    ]
  }, [latestActivity])

  const activeCase = useMemo(
    () =>
      route.id === 'case-detail' || route.id === 'case-validation'
        ? caseItems.find((item) => item.id === route.caseId) ?? null
        : null,
    [route, caseItems],
  )

  const handleCall = (caseItem: CaseRecord) => {
    window.location.href = `tel:${caseItem.contactPhone.replace(/\s/g, '')}`
  }

  const handleValidate = (caseItem: CaseRecord) => {
    setValidationCase(caseItem)
  }

  const handleView = (caseItem: CaseRecord) => {
    navigateCaseManager({ id: 'case-detail', caseId: caseItem.id })
  }

  const handleSummarySelect = (filter: CaseSummaryFilter) => {
    setSummaryFilter((prev) => (prev === filter ? null : filter))
    setListFilter('all')
  }

  const handleListFilter = (filter: CaseListFilter) => {
    setListFilter(filter)
    setSummaryFilter(null)
  }

  const handleValidationSubmit = (payload: { notes: string; priority: CaseRecord['priority']; assignedTo: string }) => {
    if (!validationCase) return
    setCaseItems((prev) =>
      prev.map((item) =>
        item.id === validationCase.id
          ? {
              ...item,
              notes: payload.notes,
              priority: payload.priority,
              assignedTo: payload.assignedTo,
              status: 'followup',
              updatedAt: new Date(),
            }
          : item,
      ),
    )
    setValidationCase(null)
  }

  if (route.id === 'case-detail' && activeCase) {
    return (
      <CaseDetailScreen
        caseItem={activeCase}
        onBack={() => navigateCaseManager({ id: 'dashboard' })}
        onCall={handleCall}
        onValidate={handleValidate}
        onView={handleView}
      />
    )
  }

  if (route.id === 'case-validation' && activeCase) {
    return (
      <CaseValidationScreen
        caseItem={activeCase}
        assignments={ASSIGNMENT_OPTIONS}
        onBack={() => navigateCaseManager({ id: 'dashboard' })}
        onSubmit={handleValidationSubmit}
      />
    )
  }

  if (route.id === 'users') {
    return (
      <ScreenScaffold title="Usuarios" subtitle="Gestor de Casos" onBack={() => navigateCaseManager({ id: 'dashboard' })}>
        <div className="space-y-3 pt-2">
          {['Carlos M.', 'Ana R.', 'Brigada Social', 'Equipo Infraestructura'].map((name) => (
            <GlassCard key={name} className="flex items-center justify-between text-sm">
              <span className="text-ink">{name}</span>
              <span className="text-xs text-ink-subtle">Casos activos: {Math.floor(Math.random() * 6) + 1}</span>
            </GlassCard>
          ))}
        </div>
      </ScreenScaffold>
    )
  }

  if (route.id === 'needs') {
    return (
      <ScreenScaffold
        title="Necesidades"
        subtitle="Gestor de Casos"
        onBack={() => navigateCaseManager({ id: 'dashboard' })}
      >
        <div className="space-y-3 pt-2">
          {state.needs.length ? (
            state.needs.slice(0, 8).map((need) => (
              <GlassCard key={need.id} className="space-y-1 text-sm">
                <NeedItemLabel name={need.type} className="text-ink" />
                <p className="text-xs text-ink-subtle">
                  Requerido: {need.required} · Disponible: {need.available}
                </p>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-sm text-ink-subtle">No hay necesidades cargadas aún.</GlassCard>
          )}
        </div>
      </ScreenScaffold>
    )
  }

  if (route.id === 'settings') {
    return (
      <ScreenScaffold
        title="Configuración"
        subtitle="Gestor de Casos"
        onBack={() => navigateCaseManager({ id: 'dashboard' })}
      >
        <div className="space-y-3 pt-2">
          <GlassCard className="space-y-2 text-sm">
            <p className="text-ink">Notificaciones críticas</p>
            <p className="text-xs text-ink-subtle">Recibe alertas cuando un caso pase a prioridad alta.</p>
          </GlassCard>
          <GlassCard className="space-y-2 text-sm">
            <p className="text-ink">Asignación automática</p>
            <p className="text-xs text-ink-subtle">Define si los casos nuevos se asignan a un centro por zona.</p>
          </GlassCard>
        </div>
      </ScreenScaffold>
    )
  }

  if (route.id === 'system') {
    return (
      <ScreenScaffold
        title="Sistema"
        subtitle="Gestor de Casos"
        onBack={() => navigateCaseManager({ id: 'dashboard' })}
      >
        <div className="space-y-3 pt-2">
          <GlassCard className="space-y-2 text-sm">
            <p className="text-ink">Sincronización de datos</p>
            <p className="text-xs text-ink-subtle">Última actualización: {timeAgo(new Date())}</p>
          </GlassCard>
          <GlassCard className="space-y-2 text-sm">
            <p className="text-ink">Estado de la red</p>
            <p className="text-xs text-ink-subtle">
              {mapData.isLoading ? 'Cargando información...' : 'Operativo'}
            </p>
          </GlassCard>
        </div>
      </ScreenScaffold>
    )
  }

  if (route.id === 'activity') {
    return (
      <ScreenScaffold
        title="Actividad reciente"
        subtitle="Gestor de Casos"
        onBack={() => navigateCaseManager({ id: 'dashboard' })}
      >
        <div className="space-y-3 pt-2">
          {activityItems.map((activity) => (
            <GlassCard key={activity.id} className="space-y-1 text-sm">
              <p className="text-ink">{activity.description}</p>
              <p className="text-xs text-ink-faint">{timeAgo(activity.createdAt)}</p>
            </GlassCard>
          ))}
        </div>
      </ScreenScaffold>
    )
  }

  return (
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto px-5 pb-24 pt-2 lg:px-8 lg:pb-8">
      <div className="space-y-6">
        <CaseManagerHeader
          name={profile?.full_name || user?.email || 'Gestor'}
          pendingCount={pendingCount}
          notificationCount={notificationCount}
          onLogoClick={() => navigateCaseManager({ id: 'dashboard' })}
          onOpenNotifications={onOpenNotifications}
          onOpenProfile={() => onNavigate('profile')}
        />

        <CaseSummaryCards items={summaryItems} active={summaryFilter} onSelect={handleSummarySelect} />

        <PriorityCasesList
          cases={priorityCases}
          onCall={handleCall}
          onValidate={handleValidate}
          onView={handleView}
        />

        <AllCasesList
          cases={filteredCases}
          filters={listFilters}
          activeFilter={listFilter}
          onChangeFilter={handleListFilter}
          onCall={handleCall}
          onValidate={handleValidate}
          onView={handleView}
        />

        <CaseQuickActions
          counts={{
            users: 7,
            reports: mapData.cases.length || 2,
            needs: state.needs.length,
            settings: 1,
            system: 1,
          }}
          onAction={(id) => {
            if (id === 'reports') {
              onNavigate('reports')
              return
            }
            navigateCaseManager({ id })
          }}
        />

        <RecentActivity items={activityItems} onViewAll={() => navigateCaseManager({ id: 'activity' })} />
      </div>

      <CaseValidationModal
        open={Boolean(validationCase)}
        caseItem={validationCase}
        assignments={ASSIGNMENT_OPTIONS}
        onClose={() => setValidationCase(null)}
        onSubmit={handleValidationSubmit}
      />
    </div>
  )
}
