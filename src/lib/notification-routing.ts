import type { TabId } from '@/components/faro/app-navigation'
import type { CoordinatorModuleId } from '@/services/coordinator-service'

export interface NotificationNavigationTarget {
  tab?: TabId
  flow?: 'coordinator-request'
  focusRequestId?: string
  focusReportId?: string
  coordinatorModule?: CoordinatorModuleId
}

/** Parsea action_url generado por triggers SQL (ej. tab:admin:request:UUID). */
export function parseNotificationActionUrl(actionUrl: string | null | undefined): NotificationNavigationTarget | null {
  if (!actionUrl) return null
  const parts = actionUrl.split(':')
  if (parts[0] !== 'tab') return null

  const tab = parts[1] as TabId
  const target: NotificationNavigationTarget = { tab }

  if (tab === 'admin' && parts[2] === 'request' && parts[3]) {
    target.focusRequestId = parts[3]
  }
  if (tab === 'ops') {
    if (parts[2] === 'reports' && parts[3]) {
      target.coordinatorModule = 'reports'
      target.focusReportId = parts[3]
    } else if (parts[2] === 'needs') {
      target.coordinatorModule = 'needs'
    } else {
      target.coordinatorModule = 'dashboard'
    }
  }
  if (tab === 'profile' && parts[2] === 'coordinator-request') {
    target.flow = 'coordinator-request'
  }

  return target
}

export function getNotificationActionLabel(actionUrl: string | null | undefined, type?: string): string {
  const target = parseNotificationActionUrl(actionUrl)
  if (target?.focusRequestId) return 'Abrir solicitud'
  if (target?.focusReportId) return 'Ver reporte'
  if (target?.coordinatorModule === 'needs') return 'Ver necesidades'
  if (target?.tab === 'ops') return 'Ir a Mi Centro'
  if (target?.tab === 'system') return 'Ir a usuarios'
  if (target?.tab === 'admin') return 'Ir a administración'
  if (target?.flow === 'coordinator-request') return 'Responder'
  if (type?.includes('approved')) return 'Ir a Mi Centro'
  if (type?.includes('rejected') || type?.includes('info_request')) return 'Ver solicitud'
  return 'Abrir'
}

export function dispatchNotificationNavigation(target: NotificationNavigationTarget) {
  window.dispatchEvent(
    new CustomEvent('faro:notification-navigate', {
      detail: target,
    }),
  )
}

export function parseNavQueryParam(search: string): NotificationNavigationTarget | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const nav = params.get('nav')
  if (!nav) return null
  return parseNotificationActionUrl(decodeURIComponent(nav))
}
