import { supabase } from '@/lib/supabase'
import type { OperationalContext, OperationalTimelineEntry } from '@/domain/operational-intelligence.types'

export class IntelligenceRepository {
  async saveContextSnapshot(context: OperationalContext): Promise<void> {
    const { error } = await supabase.from('intelligence_snapshots').insert({
      context: JSON.parse(JSON.stringify(context)),
      risk_score: context.globalRisk.score,
      risk_level: context.globalRisk.level,
      timestamp: context.timestamp.toISOString(),
    })
    if (error) throw error
  }

  async getLatestSnapshot(): Promise<OperationalContext | null> {
    const { data, error } = await supabase
      .from('intelligence_snapshots')
      .select('context')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.context as OperationalContext ?? null
  }

  async saveTimelineEntry(entry: OperationalTimelineEntry): Promise<void> {
    const { error } = await supabase.from('operational_timeline').insert({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      type: entry.type,
      title: entry.title,
      description: entry.description,
      severity: entry.severity,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    })
    if (error) throw error
  }

  async listTimeline(limit = 100): Promise<OperationalTimelineEntry[]> {
    const { data, error } = await supabase
      .from('operational_timeline')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      timestamp: new Date(row.timestamp as string),
      type: row.type as OperationalTimelineEntry['type'],
      title: row.title as string,
      description: row.description as string,
      severity: row.severity as OperationalTimelineEntry['severity'],
      entityId: (row.entity_id as string) ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    }))
  }
}

export const intelligenceRepository = new IntelligenceRepository()
