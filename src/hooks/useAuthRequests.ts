import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/auth-service'
import type { ApproveCoordinatorRequestInput, SubmitCoordinatorRequestInput } from '@/repositories/auth-types'
import { useAuth } from '@/store/auth-context'
import { NOTIFICATION_QUERY_KEYS } from '@/hooks/useAdminNotifications'
import { USER_NOTIFICATION_QUERY_KEYS } from '@/hooks/useUserNotifications'

export const AUTH_QUERY_KEYS = {
  profile: ['auth', 'profile'] as const,
  myRequests: ['auth', 'coordinator-requests', 'mine'] as const,
  pendingRequests: ['auth', 'coordinator-requests', 'pending'] as const,
  profilesAdmin: ['auth', 'profiles', 'admin'] as const,
  audit: ['auth', 'audit'] as const,
}

export function useMyCoordinatorRequests() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  return useQuery({
    queryKey: [...AUTH_QUERY_KEYS.myRequests, user?.id ?? email],
    queryFn: () => authService.listMyCoordinatorRequests(email, user?.id ?? null),
    enabled: Boolean(email),
  })
}

export function usePendingCoordinatorRequests(enabled: boolean) {
  return useQuery({
    queryKey: AUTH_QUERY_KEYS.pendingRequests,
    queryFn: () => authService.listPendingCoordinatorRequests(),
    enabled,
  })
}

export function useAuthAudit(enabled: boolean) {
  return useQuery({
    queryKey: AUTH_QUERY_KEYS.audit,
    queryFn: () => authService.listAuthAudit(),
    enabled,
  })
}

export function useAdminProfiles(enabled: boolean) {
  return useQuery({
    queryKey: AUTH_QUERY_KEYS.profilesAdmin,
    queryFn: () => authService.listProfilesForAdmin(),
    enabled,
  })
}

export function useCoordinatorRequestMutations() {
  const queryClient = useQueryClient()
  const { user, refreshProfile } = useAuth()

  const submit = useMutation({
    mutationFn: (input: SubmitCoordinatorRequestInput) =>
      authService.submitCoordinatorRequest(input, user?.id ?? null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.myRequests })
    },
  })

  const approve = useMutation({
    mutationFn: (input: ApproveCoordinatorRequestInput) => authService.approveCoordinatorRequest(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.pendingRequests })
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.myRequests })
      await refreshProfile()
    },
  })

  const reject = useMutation({
    mutationFn: ({ requestId, reviewNotes }: { requestId: string; reviewNotes?: string }) =>
      authService.rejectCoordinatorRequest(requestId, reviewNotes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.pendingRequests })
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.myRequests })
    },
  })

  const requestInfo = useMutation({
    mutationFn: ({ requestId, message }: { requestId: string; message: string }) =>
      authService.requestCoordinatorInfo(requestId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.pendingRequests })
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.myRequests })
    },
  })

  const respondInfo = useMutation({
    mutationFn: ({ requestId, response }: { requestId: string; response: string }) =>
      authService.respondCoordinatorInfo(requestId, response),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.pendingRequests })
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.myRequests })
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.admin })
      void queryClient.invalidateQueries({ queryKey: USER_NOTIFICATION_QUERY_KEYS.mine })
    },
  })

  return { submit, approve, reject, requestInfo, respondInfo }
}
