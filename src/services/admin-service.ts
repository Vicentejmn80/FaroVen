import { formatAuthError } from '@/lib/auth-errors'
import type { AdminUpdateProfileInput } from '@/lib/admin-types'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/repositories/auth-types'
import { adminRepository } from '@/repositories/admin-repository'
import { needRepository } from '@/repositories/need-repository'
import { reportRepository } from '@/repositories/report-repository'

export const adminService = {
  listRegistry: () => adminRepository.listRegistry(),
  listCoordinators: () => adminRepository.listCoordinators(),
  listNotifications: (limit?: number) => adminRepository.listNotifications(limit),
  listNeeds: () => needRepository.list(),
  listReports: () => reportRepository.list(),

  deleteSite: (siteType: Parameters<typeof adminRepository.deleteSite>[0], siteId: string) =>
    adminRepository.deleteSite(siteType, siteId),

  removeCoordinator: (profileId: string) => adminRepository.removeCoordinator(profileId),

  revokeCoordinatorRole: (userId: string) => adminRepository.revokeCoordinatorRole(userId),

  updateUserStatus: (userId: string, status: ProfileRow['status']) =>
    adminRepository.updateUserStatus(userId, status),

  updateProfile: (input: AdminUpdateProfileInput) => adminRepository.updateProfile(input),

  deleteNeed: (needId: string) => adminRepository.deleteNeed(needId),

  deleteNotification: (notificationId: string) => adminRepository.deleteNotification(notificationId),

  async updateNeed(
    id: string,
    patch: {
      itemName?: string
      priority?: 'critical' | 'high' | 'medium' | 'low'
      qtyRequired?: number
      qtyReceived?: number
      notes?: string
    },
  ) {
    return needRepository.update({ id, ...patch })
  },

  async reviewReport(id: string, status: 'verified' | 'dismissed', reviewNotes?: string) {
    return reportRepository.updateReview({ id, status, reviewNotes })
  },

  async restoreReport(id: string) {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'pending', review_notes: null, reviewed_at: null })
      .eq('id', id)
    if (error) throw new Error(formatAuthError(error.message))
    return reportRepository.list().then((rows) => rows.find((r) => r.id === id) ?? null)
  },
}
