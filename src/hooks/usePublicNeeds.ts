import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CoverageReservation,
  NeedTimeline,
  NeedVerification,
  PublicNeed,
  SuccessCase,
} from '@/domain/public-need.types'
import { requireSupabase } from '@/lib/require-supabase'
import {
  fetchNeedTimeline,
  fetchNeedVerifications,
  fetchOperationalPublicNeeds,
  fetchPublicNeeds,
  fetchSuccessCases,
  reserveNeedCoverage,
  updateNeedReservationStatus,
  verifyPublicNeedEntry,
} from '@/services/public-need-service'
import { FARO_QUERY_KEYS } from './query-keys'

export function usePublicNeeds() {
  return useQuery<PublicNeed[]>({
    queryKey: [FARO_QUERY_KEYS.publicNeeds, 'visible'],
    queryFn: async () => {
      requireSupabase()
      return fetchPublicNeeds()
    },
    staleTime: 20_000,
  })
}

export function useOperationalPublicNeeds() {
  return useQuery<PublicNeed[]>({
    queryKey: [FARO_QUERY_KEYS.publicNeeds, 'operational'],
    queryFn: async () => {
      requireSupabase()
      return fetchOperationalPublicNeeds()
    },
    staleTime: 20_000,
  })
}

export function useNeedTimeline(publicNeedId: string | null) {
  return useQuery<NeedTimeline[]>({
    queryKey: [FARO_QUERY_KEYS.needTimeline, publicNeedId],
    queryFn: async () => {
      requireSupabase()
      if (!publicNeedId) return []
      return fetchNeedTimeline(publicNeedId)
    },
    enabled: Boolean(publicNeedId),
    staleTime: 20_000,
  })
}

export function useNeedVerifications(publicNeedId: string | null) {
  return useQuery<NeedVerification[]>({
    queryKey: [FARO_QUERY_KEYS.needVerifications, publicNeedId],
    queryFn: async () => {
      requireSupabase()
      if (!publicNeedId) return []
      return fetchNeedVerifications(publicNeedId)
    },
    enabled: Boolean(publicNeedId),
    staleTime: 20_000,
  })
}

export function useSuccessCases(limit = 20) {
  return useQuery<SuccessCase[]>({
    queryKey: [FARO_QUERY_KEYS.successCases, limit],
    queryFn: async () => {
      requireSupabase()
      return fetchSuccessCases(limit)
    },
    staleTime: 30_000,
  })
}

export function useCreateCoverageReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      publicNeedId: string
      collaboratorName?: string
      collaboratorType?: CoverageReservation['collaboratorType']
      quantity: number
    }) => reserveNeedCoverage(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
    },
  })
}

export function useUpdateCoverageReservationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      reservationId: string
      status: CoverageReservation['status']
    }) => updateNeedReservationStatus(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
    },
  })
}

export function useVerifyPublicNeedEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      publicNeedId: string
      checklist: string[]
      decision: 'approved' | 'rejected' | 'needs_info'
      notes?: string
      actorId: string
    }) => verifyPublicNeedEntry(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.needTimeline] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.needVerifications] })
    },
  })
}

