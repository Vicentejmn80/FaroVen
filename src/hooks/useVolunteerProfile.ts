import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { volunteerService } from '@/services/volunteer-service'
import { missionService } from '@/services/mission-service'
import { useAuth } from '@/store/auth-context'
import type { VolunteerAvailabilityStatus } from '@/domain/volunteer.types'

export function useVolunteerProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.volunteerProfile, user?.id],
    queryFn: () => volunteerService.getProfile(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useVolunteerMissions(volunteerId: string) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.volunteerMissions, volunteerId],
    queryFn: () => missionService.listByVolunteer(volunteerId),
    enabled: !!volunteerId,
  })
}

export function useCreateVolunteerProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: volunteerService.createProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] })
    },
  })
}

export function useUpdateVolunteerAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      volunteerId,
      status,
    }: {
      volunteerId: string
      status: VolunteerAvailabilityStatus
    }) => volunteerService.updateAvailability(volunteerId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] })
    },
  })
}

export function useVolunteerSkills(volunteerId: string) {
  const qc = useQueryClient()
  const addSkill = useMutation({
    mutationFn: ({ skill, proficiency }: { skill: string; proficiency?: number }) =>
      volunteerService.addSkill(volunteerId, skill, proficiency),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] }),
  })

  const removeSkill = useMutation({
    mutationFn: (skill: string) => volunteerService.removeSkill(volunteerId, skill),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.volunteerProfile] }),
  })

  return { addSkill, removeSkill }
}
