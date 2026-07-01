import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import type {
  AdminReport,
  ReportStatus,
  SupportRequest,
  SupportRequestStatus,
  SupportResource,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Admin identity check
// Llama a la función is_admin() de Postgres (SECURITY DEFINER) que compara
// el email del JWT con la tabla admin_emails.
// ---------------------------------------------------------------------------
async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

export function useIsAdmin() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: fetchIsAdmin,
    enabled: !!user,
    staleTime: 120_000,
  })
}

// ---------------------------------------------------------------------------
// Reports queue (cola de moderación de reportes ciudadanos)
// ---------------------------------------------------------------------------
async function fetchReports(status?: ReportStatus): Promise<AdminReport[]> {
  let q = supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AdminReport[]
}

export function useAdminReports(status?: ReportStatus) {
  return useQuery({
    queryKey: ['admin-reports', status ?? 'all'],
    queryFn: () => fetchReports(status),
    staleTime: 20_000,
  })
}

interface UpdateReportInput {
  id: string
  status: ReportStatus
  review_notes?: string
}

async function updateReport(input: UpdateReportInput): Promise<void> {
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

export function useUpdateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
      queryClient.invalidateQueries({ queryKey: ['coordinator-reports'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Support requests queue (cola de acompañamiento emocional)
// ---------------------------------------------------------------------------
async function fetchSupportRequests(status?: SupportRequestStatus): Promise<SupportRequest[]> {
  let q = supabase
    .from('support_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SupportRequest[]
}

export function useAdminSupportRequests(status?: SupportRequestStatus) {
  return useQuery({
    queryKey: ['admin-support-requests', status ?? 'all'],
    queryFn: () => fetchSupportRequests(status),
    staleTime: 20_000,
  })
}

interface UpdateSupportRequestInput {
  id: string
  status: SupportRequestStatus
  assigned_to?: string
  review_notes?: string
}

async function updateSupportRequest(input: UpdateSupportRequestInput): Promise<void> {
  const { error } = await supabase
    .from('support_requests')
    .update({
      status: input.status,
      assigned_to: input.assigned_to ?? null,
      review_notes: input.review_notes ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw error
}

export function useUpdateSupportRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSupportRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-requests'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Support resources directory (directorio público, editable por admin)
// ---------------------------------------------------------------------------
async function fetchSupportResources(): Promise<SupportResource[]> {
  const { data, error } = await supabase
    .from('support_resources')
    .select('*')
    .eq('is_active', true)
    .order('is_emergency', { ascending: false })
    .order('kind')
    .order('name')
  if (error) throw error
  return (data ?? []) as SupportResource[]
}

export function useSupportResources() {
  return useQuery({
    queryKey: ['support-resources'],
    queryFn: fetchSupportResources,
    staleTime: 120_000,
  })
}

// ---------------------------------------------------------------------------
// Submit support request (público, sin autenticación)
// ---------------------------------------------------------------------------
export interface SubmitSupportRequestInput {
  for_whom: SupportRequest['for_whom']
  topic: string | null
  description: string | null
  contact_method: SupportRequest['contact_method']
  contact_value: string | null
  urgent: boolean
  consent: true
}

async function submitSupportRequest(input: SubmitSupportRequestInput): Promise<void> {
  const { error } = await supabase.from('support_requests').insert(input)
  if (error) throw error
}

export function useSubmitSupportRequest() {
  return useMutation({ mutationFn: submitSupportRequest })
}
