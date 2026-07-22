import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { availabilityService } from '@/services/availability-service'
import { useRealtimeSync } from '@/supabase/use-realtime-sync'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { getWeekRange, formatDateISO } from '@/domain/availability.types'
import type { AvailabilityWeek, CoverageSummary } from '@/domain/availability.types'

export function useWeeklyAvailability(userId: string | undefined, referenceDate: Date = new Date()) {
  const { start } = getWeekRange(referenceDate)

  useRealtimeSync({
    channelName: `avail-${userId}`,
    tables: ['case_manager_availability'],
    invalidateKeys: [FARO_QUERY_KEYS.availability, FARO_QUERY_KEYS.coverage],
  })

  return useQuery<AvailabilityWeek>({
    queryKey: [FARO_QUERY_KEYS.availability, userId, formatDateISO(start)],
    queryFn: () => availabilityService.loadWeek(userId!, referenceDate),
    enabled: !!userId,
  })
}

export function useCoverageSummary(userId: string | undefined, userName: string) {
  return useQuery<CoverageSummary>({
    queryKey: [FARO_QUERY_KEYS.coverage, userId],
    queryFn: () => availabilityService.getCoverageSummary(userId!, userName),
    enabled: !!userId,
  })
}

export function useToggleSlot(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, hour }: { date: string; hour: number }) =>
      availabilityService.toggleSlot(userId!, date, hour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.availability] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coverage] })
    },
  })
}

export function useSetSlot(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, hour, available }: { date: string; hour: number; available: boolean }) =>
      availabilityService.setSlot(userId!, date, hour, available),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.availability] })
      queryClient.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coverage] })
    },
  })
}
