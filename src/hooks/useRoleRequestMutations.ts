import { useMutation, useQueryClient } from '@tanstack/react-query'
import { roleRequestService } from '@/services/role-request-service'
import { useAuth } from '@/store/auth-context'
import { FARO_QUERY_KEYS } from './query-keys'
import type { SubmitRoleRequestInput, ApproveRoleRequestInput, RejectRoleRequestInput } from '@/repositories/auth-types'

export function useSubmitRoleRequest() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: SubmitRoleRequestInput) => {
      if (!user) throw new Error('Usuario no autenticado')
      return roleRequestService.submit({ ...input, userId: user.id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.roleRequests] })
    },
  })
}

export function useApproveRoleRequest() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: ApproveRoleRequestInput) => {
      if (!user) throw new Error('Usuario no autenticado')
      return roleRequestService.approve({ ...input, reviewerId: user.id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.roleRequests] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] })
    },
  })
}

export function useRejectRoleRequest() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: RejectRoleRequestInput) => {
      if (!user) throw new Error('Usuario no autenticado')
      return roleRequestService.reject({ ...input, reviewerId: user.id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.roleRequests] })
    },
  })
}

export function useReviewRoleRequest() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (requestId: string) => {
      if (!user) throw new Error('Usuario no autenticado')
      return roleRequestService.markUnderReview(requestId, user.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.roleRequests] })
    },
  })
}
