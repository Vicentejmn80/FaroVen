import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminUpdateProfileInput } from '@/lib/admin-types'
import type { ProfileRow } from '@/repositories/auth-types'
import { adminService } from '@/services/admin-service'
import { AUTH_QUERY_KEYS } from '@/hooks/useAuthRequests'

export const ADMIN_QUERY_KEYS = {
  registry: ['admin', 'registry'] as const,
  coordinators: ['admin', 'coordinators'] as const,
  needs: ['admin', 'needs'] as const,
  reports: ['admin', 'reports'] as const,
  notifications: ['admin', 'notifications'] as const,
}

function invalidateAdminQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.registry })
  void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.coordinators })
  void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.profilesAdmin })
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

export function useAdminReports(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.reports,
    queryFn: () => adminService.listReports(),
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

export function useAdminMutations() {
  const queryClient = useQueryClient()

  const afterUserChange = async () => {
    invalidateAdminQueries(queryClient)
    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.audit })
  }

  const deleteSite = useMutation({
    mutationFn: ({ siteType, siteId }: { siteType: 'hospital' | 'shelter' | 'supply_center'; siteId: string }) =>
      adminService.deleteSite(siteType, siteId),
    onSuccess: () => invalidateAdminQueries(queryClient),
  })

  const removeCoordinator = useMutation({
    mutationFn: (profileId: string) => adminService.removeCoordinator(profileId),
    onSuccess: () => afterUserChange(),
  })

  const revokeCoordinatorRole = useMutation({
    mutationFn: (userId: string) => adminService.revokeCoordinatorRole(userId),
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

  const deleteNeed = useMutation({
    mutationFn: (needId: string) => adminService.deleteNeed(needId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.needs })
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

  const deleteNotification = useMutation({
    mutationFn: (id: string) => adminService.deleteNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.notifications })
    },
  })

  return {
    deleteSite,
    removeCoordinator,
    revokeCoordinatorRole,
    updateUserStatus,
    updateProfile,
    deleteNeed,
    updateNeed,
    reviewReport,
    restoreReport,
    deleteNotification,
  }
}
