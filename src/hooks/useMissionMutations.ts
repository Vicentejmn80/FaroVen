import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { missionService } from '@/services/mission-service'
import { matchingService } from '@/services/matching-service'
import { notifyUser } from '@/lib/notify'
import { notifyVolunteer } from '@/services/mission-notification-service'
import type { MissionStage } from '@/domain/mission.types'

function invalidateMissionData(qc: ReturnType<typeof useQueryClient>, missionId?: string) {
  qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
  if (missionId) {
    qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.mission, missionId] })
    qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionEvents, missionId] })
    qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments, missionId] })
  }
}

export function useCreateMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: missionService.create,
    onSuccess: (result) => {
      invalidateMissionData(qc, result.mission.id)
    },
  })
}

export function useTransitionMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      missionId,
      toStage,
      actorId,
      actorName,
      comment,
    }: {
      missionId: string
      toStage: MissionStage
      actorId?: string
      actorName?: string
      comment?: string
    }) => missionService.transition(missionId, toStage, actorId, actorName, comment),
    onSuccess: (_, { missionId }) => {
      invalidateMissionData(qc, missionId)
    },
  })
}

export function useStartMatching() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      missionId,
      actorId,
    }: {
      missionId: string
      actorId?: string
    }) => missionService.startMatching(missionId, actorId),
    onSuccess: async (result) => {
      invalidateMissionData(qc, result.mission.id)
      await matchingService.runMatching(result.mission.id)
    },
  })
}

export function useAssignVolunteer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      missionId,
      volunteerId,
      actorId,
    }: {
      missionId: string
      volunteerId: string
      actorId?: string
    }) => missionService.assignVolunteer(missionId, volunteerId, actorId),
    onSuccess: (_, { missionId, volunteerId }) => {
      invalidateMissionData(qc, missionId)
      notifyVolunteer({
        volunteerId,
        volunteerName: '',
        missionId,
        missionTitle: '',
        event: 'volunteer_assigned',
      })
    },
  })
}

export function useRespondMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      action,
      volunteerId,
    }: {
      assignmentId: string
      action: 'accept' | 'reject'
      volunteerId: string
    }) =>
      action === 'accept'
        ? missionService.acceptAssignment(assignmentId, volunteerId)
        : missionService.rejectAssignment(assignmentId, volunteerId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
      if (variables.action === 'accept') {
        notifyUser(variables.volunteerId, 'Misión aceptada', 'Has aceptado la misión. Dirígete al punto de encuentro.')
      }
    },
  })
}

export function useUpdateMissionAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      status,
    }: {
      assignmentId: string
      status: 'en_route' | 'on_site' | 'completed'
    }) => {
      if (status === 'en_route') return missionService.markEnRoute(assignmentId)
      if (status === 'on_site') return missionService.markOnSite(assignmentId)
      return missionService.markCompleted(assignmentId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missions] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.missionAssignments] })
    },
  })
}
