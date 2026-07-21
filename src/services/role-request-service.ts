import { supabase } from '@/lib/supabase'
import { roleRequestRepository } from '@/repositories/role-request-repository'
import type { SubmitRoleRequestInput, ApproveRoleRequestInput, RejectRoleRequestInput } from '@/repositories/auth-types'

export const roleRequestService = {
  async list() {
    return roleRequestRepository.list()
  },

  async listByUser(userId: string) {
    return roleRequestRepository.listByUser(userId)
  },

  async submit(input: SubmitRoleRequestInput & { userId: string }) {
    return roleRequestRepository.create(input)
  },

  async approve(input: ApproveRoleRequestInput & { reviewerId: string }) {
    const { error } = await supabase.rpc('approve_role_request', {
      p_request_id: input.requestId,
      p_reviewer_id: input.reviewerId,
      p_review_notes: input.reviewNotes ?? null,
    })
    if (error) throw error
    return roleRequestRepository.findById(input.requestId)
  },

  async reject(input: RejectRoleRequestInput & { reviewerId: string }) {
    const { error } = await supabase.rpc('reject_role_request', {
      p_request_id: input.requestId,
      p_reviewer_id: input.reviewerId,
      p_review_notes: input.reviewNotes ?? null,
    })
    if (error) throw error
    return roleRequestRepository.findById(input.requestId)
  },

  async markUnderReview(requestId: string, reviewerId: string) {
    const { error } = await supabase.rpc('mark_role_request_under_review', {
      p_request_id: requestId,
      p_reviewer_id: reviewerId,
    })
    if (error) throw error
    return roleRequestRepository.findById(requestId)
  },
}
