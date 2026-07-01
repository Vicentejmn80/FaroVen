import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CoordinatorSiteType, Person, PersonStatus } from '@/lib/types'

export interface PersonUpsertRow {
  id?: string
  first_name: string
  last_name: string
  status: PersonStatus
}

export interface BulkUpsertPersonsInput {
  siteType: 'hospital' | 'shelter'
  siteId: string
  rows: PersonUpsertRow[]
  evidenceUrl?: string
}

export interface UploadPersonListPhotoInput {
  siteType: 'hospital' | 'shelter'
  siteId: string
  file: File
}

async function fetchSitePersons(siteType: 'hospital' | 'shelter', siteId: string): Promise<Person[]> {
  const column = siteType === 'hospital' ? 'hospital_id' : 'shelter_id'
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq(column, siteId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

async function bulkUpsertPersons(input: BulkUpsertPersonsInput): Promise<number> {
  const now = new Date().toISOString()
  const evidenceNote = input.evidenceUrl ? `Evidencia de lista: ${input.evidenceUrl}` : null
  let saved = 0

  for (const row of input.rows) {
    const first = row.first_name.trim()
    const last = row.last_name.trim()
    if (!first && !last) continue

    const payload = {
      first_name: first || 'Sin nombre',
      last_name: last || 'Sin apellido',
      status: row.status,
      hospital_id: input.siteType === 'hospital' ? input.siteId : null,
      shelter_id: input.siteType === 'shelter' ? input.siteId : null,
      confidence: 'high' as const,
      reported_at: now,
      updated_at: now,
      notes: evidenceNote,
    }

    if (row.id) {
      const { error } = await supabase.from('persons').update(payload).eq('id', row.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('persons').insert(payload)
      if (error) throw error
    }
    saved += 1
  }

  return saved
}

async function uploadPersonListPhoto(input: UploadPersonListPhotoInput): Promise<string> {
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${input.siteType}/${input.siteId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('person-lists')
    .upload(path, input.file, { upsert: false, contentType: input.file.type })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('person-lists').getPublicUrl(path)
  return data.publicUrl
}

export function useSitePersons(
  siteType: CoordinatorSiteType | undefined,
  siteId: string | undefined
) {
  const isRegistrySite = siteType === 'hospital' || siteType === 'shelter'

  return useQuery({
    queryKey: ['site-persons', siteType, siteId],
    queryFn: () => fetchSitePersons(siteType as 'hospital' | 'shelter', siteId!),
    enabled: isRegistrySite && !!siteId,
  })
}

export function useBulkUpsertPersons() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkUpsertPersons,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-persons'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
    },
  })
}

export function useUploadPersonListPhoto() {
  return useMutation({
    mutationFn: uploadPersonListPhoto,
  })
}

/** Parse textarea lines into editable rows (CSV or "Nombre Apellido" per line). */
export function parsePersonListText(text: string): PersonUpsertRow[] {
  const statusValues = new Set<PersonStatus>(['safe', 'injured', 'transferred', 'deceased', 'unknown'])

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim())
        const maybeStatus = parts[parts.length - 1]?.toLowerCase()
        if (parts.length >= 3 && statusValues.has(maybeStatus as PersonStatus)) {
          return {
            first_name: parts[0] ?? '',
            last_name: parts.slice(1, -1).join(' '),
            status: maybeStatus as PersonStatus,
          }
        }
        return {
          first_name: parts[0] ?? '',
          last_name: parts.slice(1).join(' ') || (parts[1] ?? ''),
          status: 'unknown' as PersonStatus,
        }
      }

      const words = line.split(/\s+/).filter(Boolean)
      if (words.length === 0) return { first_name: '', last_name: '', status: 'unknown' as PersonStatus }
      if (words.length === 1) return { first_name: words[0], last_name: '', status: 'unknown' as PersonStatus }
      return {
        first_name: words[0],
        last_name: words.slice(1).join(' '),
        status: 'unknown' as PersonStatus,
      }
    })
}
