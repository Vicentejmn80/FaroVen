import { supabase } from '@/lib/supabase'
import type { AuthAuditRow } from '@/repositories/auth-types'
import type { OperationalAuditRow } from '@/services/audit-label-service'

export const auditRepository = {
  async listAuthLogs(limit = 50): Promise<AuthAuditRow[]> {
    const { data, error } = await supabase
      .from('auth_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      actor_user_id: row.actor_user_id ? String(row.actor_user_id) : null,
      action: String(row.action),
      target_user_id: row.target_user_id ? String(row.target_user_id) : null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: String(row.created_at),
    }))
  },

  async listOperationalLogs(limit = 50): Promise<OperationalAuditRow[]> {
    const { data, error } = await supabase
      .from('operational_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      center_type: row.center_type ? String(row.center_type) : null,
      center_id: row.center_id ? String(row.center_id) : null,
      actor_label: String(row.actor_label ?? 'Sistema'),
      action: String(row.action),
      old_value: row.old_value ? String(row.old_value) : null,
      new_value: row.new_value ? String(row.new_value) : null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: String(row.created_at),
    }))
  },
}
