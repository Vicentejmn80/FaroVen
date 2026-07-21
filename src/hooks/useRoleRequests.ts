import { useQuery } from '@tanstack/react-query'
import { roleRequestService } from '@/services/role-request-service'
import { FARO_QUERY_KEYS } from './query-keys'
import { useAuth } from '@/store/auth-context'

export function useRoleRequests() {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.roleRequests],
    queryFn: () => roleRequestService.list(),
    staleTime: 15_000,
  })
}

export function useMyRoleRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.roleRequests, 'my', user?.id],
    queryFn: () => roleRequestService.listByUser(user!.id),
    enabled: !!user,
    staleTime: 15_000,
  })
}
