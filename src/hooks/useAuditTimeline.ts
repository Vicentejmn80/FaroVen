import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { auditRepository } from '@/repositories/audit-repository'
import { authService } from '@/services/auth-service'
import { humanizeAuditTimeline } from '@/services/audit-label-service'
import { useFaro } from '@/store/faro-context'
import { siteToNeedableType } from '@/lib/site-utils'

export const AUDIT_QUERY_KEYS = {
  timeline: ['audit', 'timeline'] as const,
}

export function useAuditTimeline(enabled: boolean) {
  const { sites } = useFaro()

  const query = useQuery({
    queryKey: AUDIT_QUERY_KEYS.timeline,
    enabled,
    queryFn: async () => {
      const [authLogs, operationalLogs, profiles] = await Promise.all([
        auditRepository.listAuthLogs(40),
        auditRepository.listOperationalLogs(40),
        authService.listProfilesForAdmin(),
      ])
      return { authLogs, operationalLogs, profiles }
    },
  })

  const entries = useMemo(() => {
    if (!query.data) return []

    const centerNames = new Map<string, string>()
    for (const site of sites) {
      if (site.type === 'organization') continue
      const type = siteToNeedableType(site)
      centerNames.set(`${type}:${site.id}`, site.name)
    }

    const profilesById = new Map<string, string>()
    for (const profile of query.data.profiles) {
      profilesById.set(profile.id, profile.full_name || profile.email)
    }

    return humanizeAuditTimeline({
      authLogs: query.data.authLogs,
      operationalLogs: query.data.operationalLogs,
      centerNames,
      profilesById,
    })
  }, [query.data, sites])

  return { ...query, entries }
}
