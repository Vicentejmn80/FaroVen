import { formatAuthError } from '@/lib/auth-errors'
import type { AdminUpdateProfileInput } from '@/lib/admin-types'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/repositories/auth-types'
import { adminRepository } from '@/repositories/admin-repository'
import { centerRepository } from '@/repositories/center-repository'
import { eventRepository } from '@/repositories/event-repository'
import { needRepository } from '@/repositories/need-repository'
import { reportRepository } from '@/repositories/report-repository'
import type { RegisterSiteType, UpdateCenterInput } from '@/repositories/types'

export const adminService = {
  listRegistry: () => adminRepository.listRegistry(),
  listCoordinators: () => adminRepository.listCoordinators(),
  listNotifications: (limit?: number) => adminRepository.listNotifications(limit),
  listNeeds: () => needRepository.list(),
  listReports: () => reportRepository.list(),
  listEvents: () => eventRepository.list(),
  getOperationalSettings: () => adminRepository.getOperationalSettings(),

  deleteSite: (siteType: RegisterSiteType, siteId: string) =>
    adminRepository.deleteSite(siteType, siteId),

  updateCenter: (input: UpdateCenterInput) => centerRepository.update(input),

  removeCoordinator: (profileId: string) => adminRepository.removeCoordinator(profileId),

  revokeCoordinatorRole: (userId: string) => adminRepository.revokeCoordinatorRole(userId),

  demoteUser: (userId: string) => adminRepository.demoteUser(userId),

  deleteUser: (userId: string, confirmSuperAdmin?: boolean) =>
    adminRepository.deleteUser(userId, confirmSuperAdmin),

  updateUserStatus: (userId: string, status: ProfileRow['status']) =>
    adminRepository.updateUserStatus(userId, status),

  updateProfile: (input: AdminUpdateProfileInput) => adminRepository.updateProfile(input),

  deleteNeed: (needId: string) => adminRepository.deleteNeed(needId),

  createNeed: (input: Parameters<typeof adminRepository.createNeed>[0]) =>
    adminRepository.createNeed(input),

  markNeedCovered: (needId: string) => adminRepository.markNeedCovered(needId),

  deleteNotification: (notificationId: string) => adminRepository.deleteNotification(notificationId),

  deleteReport: (reportId: string) => adminRepository.deleteReport(reportId),

  deleteEvent: (eventId: string) => adminRepository.deleteEvent(eventId),

  resetOperationalData: (preserveEmail?: string) => adminRepository.resetOperationalData(preserveEmail),

  updateOperationalSetting: (key: string, value: number) =>
    adminRepository.updateOperationalSetting(key, value),

  runMaintenanceAction: (
    action:
      | 'archive_covered_needs'
      | 'clean_dismissed_reports'
      | 'delete_test_data'
      | 'reset_dashboard'
      | 'clean_old_events'
      | 'delete_closed_needs'
      | 'clean_old_notifications',
  ) => adminRepository.runMaintenanceAction(action),

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
