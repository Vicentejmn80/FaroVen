export type CaseManagerRoute =
  | { id: 'dashboard' }
  | { id: 'case-detail'; caseId: string }
  | { id: 'case-validation'; caseId: string }
  | { id: 'users' }
  | { id: 'reports' }
  | { id: 'needs' }
  | { id: 'settings' }
  | { id: 'system' }
  | { id: 'activity' }

const ROUTE_PREFIX = '#/case-manager'

export function buildCaseManagerHash(route: CaseManagerRoute): string {
  switch (route.id) {
    case 'dashboard':
      return `${ROUTE_PREFIX}`
    case 'case-detail':
      return `${ROUTE_PREFIX}/case/${route.caseId}`
    case 'case-validation':
      return `${ROUTE_PREFIX}/case/${route.caseId}/validate`
    default:
      return `${ROUTE_PREFIX}/${route.id}`
  }
}

export function parseCaseManagerHash(hash = window.location.hash): CaseManagerRoute | null {
  if (!hash.startsWith(ROUTE_PREFIX)) return null
  const segments = hash.replace(ROUTE_PREFIX, '').split('/').filter(Boolean)
  if (segments.length === 0) return { id: 'dashboard' }
  if (segments[0] === 'case' && segments[1]) {
    if (segments[2] === 'validate') return { id: 'case-validation', caseId: segments[1] }
    return { id: 'case-detail', caseId: segments[1] }
  }
  if (segments[0] === 'users') return { id: 'users' }
  if (segments[0] === 'reports') return { id: 'reports' }
  if (segments[0] === 'needs') return { id: 'needs' }
  if (segments[0] === 'settings') return { id: 'settings' }
  if (segments[0] === 'system') return { id: 'system' }
  if (segments[0] === 'activity') return { id: 'activity' }
  return { id: 'dashboard' }
}

export function navigateCaseManager(route: CaseManagerRoute): void {
  const hash = buildCaseManagerHash(route)
  if (window.location.hash !== hash) {
    window.history.pushState(window.history.state, '', hash)
  }
  window.dispatchEvent(new CustomEvent('faro:case-manager-route'))
}
