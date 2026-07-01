import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreateReportInput } from '@/lib/types'

async function createReport(input: CreateReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    type: input.type,
    description: input.description,
    person_id: input.person_id ?? null,
    reported_by: input.reported_by ?? null,
    contact_info: input.contact_info ?? null,
    attachment_url: input.attachment_url ?? null,
    site_type: input.site_type ?? null,
    site_id: input.site_id ?? null,
    site_label: input.site_label ?? null,
    other_place_name: input.other_place_name ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  })

  if (error) throw error
}

export function useCreateReport() {
  return useMutation({
    mutationFn: createReport,
  })
}
