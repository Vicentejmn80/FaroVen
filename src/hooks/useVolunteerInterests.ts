import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { volunteerInterestService } from '@/services/volunteer-interest-service'
import type { InterestStatus } from '@/domain/volunteer-interest.types'

export const INTEREST_QUERY_KEY = ['volunteer-interests'] as const

export function useVolunteerInterests() {
  return useQuery({
    queryKey: INTEREST_QUERY_KEY,
    queryFn: () => volunteerInterestService.listInterests(),
  })
}

export function useExpressInterest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { volunteerId: string; volunteerName: string; message?: string; needId?: string }) =>
      volunteerInterestService.expressInterest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTEREST_QUERY_KEY })
    },
  })
}

export function useUpdateInterestStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ volunteerId, status }: { volunteerId: string; status: InterestStatus }) =>
      volunteerInterestService.updateInterestStatus(volunteerId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTEREST_QUERY_KEY })
    },
  })
}
