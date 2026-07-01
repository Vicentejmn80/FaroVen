import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import type { CoordinatorReport, ReportStatus } from '@/lib/types'

function coordinatorReportsEnabled(userId: string | undefined, onboardingComplete: boolean | undefined): boolean {
  return !!userId && onboardingComplete !== false
}

async function fetchCoordinatorPendingReports(): Promise<CoordinatorReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []) as CoordinatorReport[]
}

async function fetchCoordinatorReportCount(): Promise<number> {
  const { count, error } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw error
  return count ?? 0
}

export function useCoordinatorPendingReports() {
  const { user } = useAuth()
  const { data: profile } = useCoordinatorProfile()

  return useQuery({
    queryKey: ['coordinator-reports', 'pending'],
    queryFn: fetchCoordinatorPendingReports,
    enabled: coordinatorReportsEnabled(user?.id, profile?.onboarding_complete),
    staleTime: 20_000,
  })
}

export function useCoordinatorReportCount() {
  const { user } = useAuth()
  const { data: profile } = useCoordinatorProfile()

  return useQuery({
    queryKey: ['coordinator-reports', 'count'],
    queryFn: fetchCoordinatorReportCount,
    enabled: coordinatorReportsEnabled(user?.id, profile?.onboarding_complete),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}

interface UpdateCoordinatorReportInput {
  id: string
  status: ReportStatus
  review_notes?: string
}

async function updateCoordinatorReport(input: UpdateCoordinatorReportInput): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({
      status: input.status,
      review_notes: input.review_notes ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.id)

  if (error) throw error
}

export function useUpdateCoordinatorReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateCoordinatorReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-reports'] })
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
    },
  })
}
