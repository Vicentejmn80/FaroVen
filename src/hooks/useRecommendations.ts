import { useMemo } from 'react'
import { useExecutiveDashboard } from './useExecutiveDashboard'

export function useRecommendations() {
  const { data: dashboard, isLoading, error } = useExecutiveDashboard()

  const critical = useMemo(() => {
    if (!dashboard) return []
    return dashboard.recommendations.filter((r) => r.priority === 'critical')
  }, [dashboard])

  const high = useMemo(() => {
    if (!dashboard) return []
    return dashboard.recommendations.filter((r) => r.priority === 'high')
  }, [dashboard])

  const medium = useMemo(() => {
    if (!dashboard) return []
    return dashboard.recommendations.filter((r) => r.priority === 'medium')
  }, [dashboard])

  const byCategory = useMemo(() => {
    if (!dashboard) return new Map()
    const map = new Map<string, typeof dashboard.recommendations>()
    for (const rec of dashboard.recommendations) {
      const existing = map.get(rec.category) ?? []
      existing.push(rec)
      map.set(rec.category, existing)
    }
    return map
  }, [dashboard])

  return { all: dashboard?.recommendations ?? [], critical, high, medium, byCategory, isLoading, error }
}
