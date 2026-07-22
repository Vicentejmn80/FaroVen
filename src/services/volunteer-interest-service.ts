import { supabase } from '@/lib/supabase'
import { notifyUser } from '@/lib/notify'
import type { VolunteerInterest, InterestStatus } from '@/domain/volunteer-interest.types'

export const volunteerInterestService = {
  async expressInterest(input: {
    volunteerId: string
    volunteerName: string
    message?: string
    needId?: string
  }): Promise<void> {
    await notifyUser(
      input.volunteerId,
      'Interés expresado',
      input.message ?? 'Quiero ayudar',
      { type: 'volunteer_interest', needId: input.needId, status: 'pending' },
    )

    const { data: caseManagers } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'case_manager')
      .eq('status', 'active')

    if (caseManagers) {
      for (const cm of caseManagers) {
        await notifyUser(
          cm.id,
          'Voluntario interesado',
          `${input.volunteerName} quiere ayudar`,
          { type: 'volunteer_interest', volunteerId: input.volunteerId, needId: input.needId },
        )
      }
    }
  },

  async listInterests(): Promise<VolunteerInterest[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'volunteer_interest')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => ({
      volunteerId: String((row.metadata as Record<string, unknown>)?.volunteerId ?? ''),
      volunteerName: String((row.metadata as Record<string, unknown>)?.volunteerName ?? ''),
      status: ((row.metadata as Record<string, unknown>)?.status as InterestStatus) ?? 'pending',
      createdAt: new Date(String(row.created_at)),
      message: (row.metadata as Record<string, unknown>)?.message as string | undefined,
    }))
  },

  async updateInterestStatus(volunteerId: string, status: InterestStatus): Promise<void> {
    await supabase
      .from('notifications')
      .update({ metadata: { status } })
      .eq('type', 'volunteer_interest')
      .eq('metadata->>volunteerId', volunteerId)
  },
}
