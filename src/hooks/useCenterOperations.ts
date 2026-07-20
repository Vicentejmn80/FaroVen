import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import {
  getCenterProfile,
  getCenterResources,
  getCenterSupportRequests,
  getCenterEvents,
  updateCenterCapacity,
  updateCenterResource,
  createSupportRequest,
} from '@/services/center-operations-service'
import {
  type CenterCapacityUpdate,
  type SupportRequestInput,
} from '@/domain/center-operations.types'
import type { RegisterSiteType } from '@/repositories/types'

export function useCenterProfile(centerId: string, siteType: RegisterSiteType) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.centerProfile, centerId],
    queryFn: () => getCenterProfile(centerId, siteType),
    enabled: !!centerId,
  })
}

export function useCenterResources(centerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.centerResources, centerId],
    queryFn: () => getCenterResources(centerId),
    enabled: !!centerId,
  })
}

export function useCenterEvents(centerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.centerEvents, centerId],
    queryFn: () => getCenterEvents(centerId),
    enabled: !!centerId,
  })
}

export function useSupportRequests(centerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.supportRequests, centerId],
    queryFn: () => getCenterSupportRequests(centerId),
    enabled: !!centerId,
  })
}

export function useUpdateCenterCapacity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      centerId,
      siteType,
      update,
      actorId,
      actorName,
    }: {
      centerId: string
      siteType: RegisterSiteType
      update: CenterCapacityUpdate
      actorId?: string
      actorName?: string
    }) => updateCenterCapacity(centerId, siteType, update, actorId, actorName),
    onSuccess: (_, { centerId }) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerProfile, centerId] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerEvents, centerId] })
    },
  })
}

export function useUpdateCenterResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      centerId,
      siteType,
      resourceType,
      currentLevel,
      maxLevel,
      unit,
      actorId,
      actorName,
    }: {
      centerId: string
      siteType: RegisterSiteType
      resourceType: string
      currentLevel: number
      maxLevel: number
      unit: string
      actorId?: string
      actorName?: string
    }) => updateCenterResource(centerId, siteType, resourceType, currentLevel, maxLevel, unit, actorId, actorName),
    onSuccess: (_, { centerId }) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerResources, centerId] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerProfile, centerId] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerEvents, centerId] })
    },
  })
}

export function useCreateSupportRequest(centerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SupportRequestInput) => createSupportRequest(input, centerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.supportRequests, centerId] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerEvents, centerId] })
    },
  })
}
