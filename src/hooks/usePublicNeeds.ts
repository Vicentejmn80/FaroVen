import { useToast } from '@/store/toast-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CoverageInterest,
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
  fetchNeedInterests,
  fetchSuccessCases,
  approveNeedInterest,
  rejectNeedInterest,
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

export function useNeedInterests(publicNeedId: string | null) {
  return useQuery<CoverageInterest[]>({
    queryKey: [FARO_QUERY_KEYS.coverage, 'interests', publicNeedId],
    queryFn: async () => {
      requireSupabase()
      if (!publicNeedId) return []
      return fetchNeedInterests(publicNeedId)
    },
    enabled: Boolean(publicNeedId),
    staleTime: 15_000,
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

export function useApproveNeedInterest() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: { reservationId: string; operatorId: string }) => approveNeedInterest(input),
    onSuccess: () => {
      showToast('Postulación aprobada — misión creada y voluntario asignado', 'success')
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coverage] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.operationalTimeline] })
    },
  })
}

export function useRejectNeedInterest() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: { reservationId: string; operatorId: string }) => rejectNeedInterest(input),
    onSuccess: () => {
      showToast('Postulación rechazada', 'info')
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coverage] })
      void queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.operationalTimeline] })
    },
  })
}

