import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Bulletin, ConfidenceLevel, Need, Person } from '@/lib/types'
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/types'
import { fetchActiveAnchorSites } from '@/lib/supabase-queries'

export type FeedItemKind = 'bulletin' | 'need' | 'person'

export interface FeedItem {
  id: string
  kind: FeedItemKind
  headline: string
  detail?: string
  source?: string
  confidence?: ConfidenceLevel
  timestamp: string
}

function personInitials(firstName: string, lastName: string) {
  const lastInitial = lastName.trim().charAt(0)
  return lastInitial ? `${firstName.trim()} ${lastInitial}.` : firstName.trim()
}

async function fetchHomeFeed(): Promise<FeedItem[]> {
  const [bulletinsRes, needsRes, personsRes, hospitals, shelters, sourcesRes] =
    await Promise.all([
    supabase
      .from('bulletins')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(6),
    supabase
      .from('needs')
      .select('*')
      .in('priority', ['critical', 'high'])
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('persons')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(4),
    fetchActiveAnchorSites<{ id: string; name: string }>('hospitals'),
    fetchActiveAnchorSites<{ id: string; name: string }>('shelters'),
    supabase.from('sources').select('id, name'),
  ])

  if (needsRes.error) throw needsRes.error
  if (personsRes.error) throw personsRes.error
  if (sourcesRes.error) throw sourcesRes.error

  const hospitalsMap = new Map(hospitals.map((h) => [h.id, h.name]))
  const sheltersMap = new Map(shelters.map((s) => [s.id, s.name]))
  const sources = new Map((sourcesRes.data ?? []).map((s) => [s.id, s.name]))
  const anchorHospitalIds = new Set(hospitalsMap.keys())
  const anchorShelterIds = new Set(sheltersMap.keys())

  const isAnchorNeed = (need: Need) =>
    (need.needable_type === 'hospital' && anchorHospitalIds.has(need.needable_id)) ||
    (need.needable_type === 'shelter' && anchorShelterIds.has(need.needable_id))

  const isAnchorPerson = (person: Person) =>
    (person.hospital_id && anchorHospitalIds.has(person.hospital_id)) ||
    (person.shelter_id && anchorShelterIds.has(person.shelter_id))

  const bulletinItems: FeedItem[] = bulletinsRes.error
    ? []
    : (bulletinsRes.data as Bulletin[]).map((b) => ({
    id: `bulletin-${b.id}`,
    kind: 'bulletin',
    headline: b.title,
    detail: b.body,
    source: b.source_name,
    confidence: b.confidence,
    timestamp: b.published_at,
  }))

  const needItems: FeedItem[] = (needsRes.data as Need[])
    .filter(isAnchorNeed)
    .map((need) => {
    const location =
      need.needable_type === 'hospital'
        ? hospitalsMap.get(need.needable_id)
        : need.needable_type === 'shelter'
          ? sheltersMap.get(need.needable_id)
          : null

    return {
      id: `need-${need.id}`,
      kind: 'need',
      headline: `${location ?? 'Sitio'}: ${need.item_name}`,
      detail: `${PRIORITY_LABELS[need.priority]} · ${need.qty_received}/${need.qty_required} ${need.unit} (${need.pct_covered}%)`,
      timestamp: need.updated_at,
    }
  })

  const personItems: FeedItem[] = (personsRes.data as Person[])
    .filter(isAnchorPerson)
    .map((person) => {
    const location =
      (person.hospital_id && hospitalsMap.get(person.hospital_id)) ||
      (person.shelter_id && sheltersMap.get(person.shelter_id)) ||
      null

    return {
      id: `person-${person.id}`,
      kind: 'person',
      headline: `${personInitials(person.first_name, person.last_name)} · ${STATUS_LABELS[person.status]}`,
      detail: location ? `Ubicación: ${location}` : undefined,
      source: person.source_id ? sources.get(person.source_id) : undefined,
      confidence: person.confidence,
      timestamp: person.updated_at,
    }
  })

  return [...bulletinItems, ...needItems, ...personItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)
}

export function useHomeFeed() {
  return useQuery({
    queryKey: ['home-feed'],
    queryFn: fetchHomeFeed,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
