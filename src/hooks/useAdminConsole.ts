import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminUpdateProfileInput } from '@/lib/admin-types'
import type { ProfileRow } from '@/repositories/auth-types'
import type { RegisterSiteType } from '@/repositories/types'
import { adminService } from '@/services/admin-service'
import { AUTH_QUERY_KEYS } from '@/hooks/useAuthRequests'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'

export const ADMIN_QUERY_KEYS = {
  registry: ['admin', 'registry'] as const,
  coordinators: ['admin', 'coordinators'] as const,
  needs: ['admin', 'needs'] as const,
  publicNeeds: ['admin', 'public-needs'] as const,
  reports: ['admin', 'reports'] as const,
  notifications: ['admin', 'notifications'] as const,
  events: ['admin', 'events'] as const,
  operational: ['admin', 'operational-settings'] as const,
}

function invalidateAllAdmin(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.registry })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.coordinators })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.needs })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.publicNeeds })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.reports })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.notifications })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.events })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.operational })
  void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.profilesAdmin })
  void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.pendingRequests })
  void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.audit })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centers] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.needs] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reports] })
  void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.events] })
  void queryClient.invalidateQueries({ queryKey: ['sites-registry'] })
  void queryClient.invalidateQueries({ queryKey: ['anchor-sites'] })
}

export function useAdminRegistry(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.registry,
    queryFn: () => adminService.listRegistry(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminCoordinators(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.coordinators,
    queryFn: () => adminService.listCoordinators(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminNeeds(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.needs,
    queryFn: () => adminService.listNeeds(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminPublicNeeds(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.publicNeeds,
    queryFn: () => adminService.listPublicNeeds(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminReports(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.reports,
    queryFn: () => adminService.listReports(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminEvents(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.events,
    queryFn: () => adminService.listEvents(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminNotificationsList(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.notifications,
    queryFn: () => adminService.listNotifications(150),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminOperationalSettings(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.operational,
    queryFn: () => adminService.getOperationalSettings(),
    enabled,
    staleTime: 15_000,
  })
}

export function useAdminMutations() {
  const queryClient = useQueryClient()

  const afterUserChange = async () => {
    invalidateAllAdmin(queryClient)
  }

  const deleteSite = useMutation({
    mutationFn: ({ siteType, siteId }: { siteType: RegisterSiteType; siteId: string }) =>
      adminService.deleteSite(siteType, siteId),
    onSuccess: () => invalidateAllAdmin(queryClient),
  })

  const removeCoordinator = useMutation({
    mutationFn: (profileId: string) => adminService.removeCoordinator(profileId),
    onSuccess: () => afterUserChange(),
  })

  const revokeCoordinatorRole = useMutation({
    mutationFn: (userId: string) => adminService.revokeCoordinatorRole(userId),
    onSuccess: () => afterUserChange(),
  })

  const demoteUser = useMutation({
    mutationFn: (userId: string) => adminService.demoteUser(userId),
    onSuccess: () => afterUserChange(),
  })

  const deleteUser = useMutation({
    mutationFn: ({ userId, confirmSuperAdmin }: { userId: string; confirmSuperAdmin?: boolean }) =>
      adminService.deleteUser(userId, confirmSuperAdmin),
    onSuccess: () => afterUserChange(),
  })

  const updateUserStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: ProfileRow['status'] }) =>
      adminService.updateUserStatus(userId, status),
    onSuccess: () => afterUserChange(),
  })

  const updateProfile = useMutation({
    mutationFn: (input: AdminUpdateProfileInput) => adminService.updateProfile(input),
    onSuccess: () => afterUserChange(),
  })

  const createNeed = useMutation({
    mutationFn: (input: Parameters<typeof adminService.createNeed>[0]) => adminService.createNeed(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.needs })
    },
  })

  const deleteNeed = useMutation({
    mutationFn: (needId: string) => adminService.deleteNeed(needId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.needs })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.needs] })
    },
  })

  const deletePublicNeed = useMutation({
    mutationFn: (publicNeedId: string) => adminService.deletePublicNeed(publicNeedId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.publicNeeds })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
    },
  })

  const updateNeed = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: {
        itemName?: string
        priority?: 'critical' | 'high' | 'medium' | 'low'
        qtyRequired?: number
        qtyReceived?: number
        notes?: string
      }
    }) => adminService.updateNeed(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.needs })
    },
  })

  const markNeedCovered = useMutation({
    mutationFn: (needId: string) => adminService.markNeedCovered(needId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.needs })
    },
  })

  const reviewReport = useMutation({
    mutationFn: ({
      id,
      status,
      reviewNotes,
    }: {
      id: string
      status: 'verified' | 'dismissed'
      reviewNotes?: string
    }) => adminService.reviewReport(id, status, reviewNotes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.reports })
    },
  })

  const restoreReport = useMutation({
    mutationFn: (id: string) => adminService.restoreReport(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.reports })
    },
  })

  const deleteReport = useMutation({
    mutationFn: (id: string) => adminService.deleteReport(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.reports })
    },
  })

  const deleteEvent = useMutation({
    mutationFn: (id: string) => adminService.deleteEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.events })
    },
  })

  const deleteNotification = useMutation({
    mutationFn: (id: string) => adminService.deleteNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.notifications })
    },
  })

  const resetOperationalData = useMutation({
    mutationFn: (preserveEmail?: string) => adminService.resetOperationalData(preserveEmail),
    onSuccess: () => invalidateAllAdmin(queryClient),
  })

  const updateOperationalSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) =>
      adminService.updateOperationalSetting(key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.operational })
    },
  })

  const runMaintenanceAction = useMutation({
    mutationFn: (
      action:
        | 'archive_covered_needs'
        | 'clean_dismissed_reports'
        | 'delete_test_data'
        | 'reset_dashboard'
        | 'clean_old_events'
        | 'delete_closed_needs'
        | 'clean_old_notifications',
    ) => adminService.runMaintenanceAction(action),
    onSuccess: () => invalidateAllAdmin(queryClient),
  })

  return {
    deleteSite,
    removeCoordinator,
    revokeCoordinatorRole,
    demoteUser,
    deleteUser,
    updateUserStatus,
    updateProfile,
    createNeed,
    deleteNeed,
    deletePublicNeed,
    updateNeed,
    markNeedCovered,
    reviewReport,
    restoreReport,
    deleteReport,
    deleteEvent,
    deleteNotification,
    resetOperationalData,
    runMaintenanceAction,
    updateOperationalSetting,
  }
}
