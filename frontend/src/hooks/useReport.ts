import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Report, ReportType } from '@/lib/types'

interface CreateReportInput {
  type: ReportType
  description: string
  person_id?: string | null
  reported_by?: string
  contact_info?: string
  attachment_url?: string | null
}

async function createReport(input: CreateReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    type: input.type,
    description: input.description,
    person_id: input.person_id ?? null,
    reported_by: input.reported_by ?? null,
    contact_info: input.contact_info ?? null,
    attachment_url: input.attachment_url ?? null,
  })

  if (error) throw error
}

export function useCreateReport() {
  return useMutation({
    mutationFn: createReport,
  })
}
