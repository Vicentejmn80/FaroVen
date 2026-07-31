import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import {
  getCenterProfile,
  getCenterResources,
  getCenterSupportRequests,
  getCenterEvents,
  getInventoryMovements,
  updateCenterCapacity,
  updateCenterResource,
  updateCenterDispatchMode,
  setCatalogInventoryItem,
  removeCatalogInventoryItem,
  createSupportRequest,
  findCentersWithStock,
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
    staleTime: 8_000,
  })
}

export function useInventoryMovements(centerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.centerEvents, 'inventory-movements', centerId],
    queryFn: () => getInventoryMovements(centerId),
    enabled: !!centerId,
    staleTime: 8_000,
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

/** Lookup GC: centros con stock de un recurso del catálogo. */
export function useCentersWithStock(resourceType: string | undefined, minQty = 1) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.centerResources, 'stock-lookup', resourceType, minQty],
    queryFn: () => findCentersWithStock(resourceType!, minQty),
    enabled: !!resourceType,
    staleTime: 15_000,
  })
}

function invalidateInventory(qc: ReturnType<typeof useQueryClient>, centerId: string) {
  qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerResources, centerId] })
  qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerProfile, centerId] })
  qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerEvents, centerId] })
  qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerEvents, 'inventory-movements', centerId] })
  qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.centerResources, 'stock-lookup'] })
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

export function useUpdateCenterDispatchMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      centerId,
      siteType,
      dispatchMode,
      actorId,
      actorName,
    }: {
      centerId: string
      siteType: RegisterSiteType
      dispatchMode: 'brigade' | 'needs_volunteers' | 'mixed'
      actorId?: string
      actorName?: string
    }) => updateCenterDispatchMode(centerId, siteType, dispatchMode, actorId, actorName),
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
    onSuccess: (_, { centerId }) => invalidateInventory(qc, centerId),
  })
}

export function useSetCatalogInventory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setCatalogInventoryItem,
    onSuccess: (_, vars) => invalidateInventory(qc, vars.centerId),
  })
}

export function useRemoveCatalogInventory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeCatalogInventoryItem,
    onSuccess: (_, vars) => invalidateInventory(qc, vars.centerId),
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
