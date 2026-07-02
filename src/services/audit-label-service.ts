import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CheckCircle2,
  LogIn,
  LogOut,
  Package,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react'
import type { AuthAuditRow } from '@/repositories/auth-types'

export interface OperationalAuditRow {
  id: string
  center_type: string | null
  center_id: string | null
  actor_label: string
  action: string
  old_value: string | null
  new_value: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type AuditSemanticTone = 'info' | 'success' | 'warning' | 'critical' | 'neutral'

export interface HumanizedAuditEntry {
  id: string
  message: string
  actor: string
  centerName?: string
  icon: LucideIcon
  tone: AuditSemanticTone
  createdAt: string
  source: 'auth' | 'operational'
}

function centerLabel(type: string | null | undefined, name?: string): string {
  if (name) return name
  if (type === 'hospital') return 'Hospital'
  if (type === 'shelter') return 'Refugio'
  if (type === 'supply_center') return 'Centro de acopio'
  return 'Centro'
}

function normalizeAuthAction(action: string): string {
  if (action === 'auth_login') return 'login'
  if (action === 'auth_logout') return 'logout'
  return action
}

function resolveActor(
  row: AuthAuditRow,
  profilesById: Map<string, string>,
  meta: Record<string, unknown>,
): string {
  return (
    (row.target_user_id && profilesById.get(row.target_user_id)) ||
    (row.actor_user_id && profilesById.get(row.actor_user_id)) ||
    (typeof meta.applicant_email === 'string' ? meta.applicant_email : '') ||
    (typeof meta.applicant_name === 'string' ? meta.applicant_name : '') ||
    (typeof meta.email === 'string' ? meta.email : '') ||
    'Usuario'
  )
}

function humanizeAuthEntry(row: AuthAuditRow, profilesById: Map<string, string>): HumanizedAuditEntry {
  const meta = row.metadata ?? {}
  const actor = resolveActor(row, profilesById, meta)
  const action = normalizeAuthAction(row.action)

  switch (action) {
    case 'login':
      return {
        id: row.id,
        message: `${actor} inició sesión.`,
        actor,
        icon: LogIn,
        tone: 'info',
        createdAt: row.created_at,
        source: 'auth',
      }
    case 'logout':
      return {
        id: row.id,
        message: `${actor} cerró sesión.`,
        actor,
        icon: LogOut,
        tone: 'neutral',
        createdAt: row.created_at,
        source: 'auth',
      }
    case 'email_confirmed':
      return {
        id: row.id,
        message: `${actor} confirmó su correo electrónico.`,
        actor,
        icon: ShieldCheck,
        tone: 'success',
        createdAt: row.created_at,
        source: 'auth',
      }
    case 'user_created':
      return {
        id: row.id,
        message: `Se creó la cuenta de ${actor}.`,
        actor,
        icon: UserPlus,
        tone: 'success',
        createdAt: row.created_at,
        source: 'auth',
      }
    case 'coordinator_request_approved': {
      const center = typeof meta.site_type === 'string' ? centerLabel(meta.site_type) : 'un centro'
      return {
        id: row.id,
        message: `Se aprobó la solicitud de Coordinador para ${actor}.`,
        actor,
        centerName: center,
        icon: CheckCircle2,
        tone: 'success',
        createdAt: row.created_at,
        source: 'auth',
      }
    }
    case 'coordinator_request_rejected':
      return {
        id: row.id,
        message: `Se rechazó la solicitud de Coordinador de ${actor}.`,
        actor,
        icon: XCircle,
        tone: 'warning',
        createdAt: row.created_at,
        source: 'auth',
      }
    case 'role_changed': {
      const newRole = typeof meta.new_role === 'string' ? meta.new_role : 'nuevo rol'
      return {
        id: row.id,
        message: `Se actualizó el rol de ${actor} a ${newRole.replace('_', ' ')}.`,
        actor,
        icon: ShieldCheck,
        tone: 'info',
        createdAt: row.created_at,
        source: 'auth',
      }
    }
    default:
      return {
        id: row.id,
        message: `Actividad registrada para ${actor}.`,
        actor,
        icon: ShieldCheck,
        tone: 'neutral',
        createdAt: row.created_at,
        source: 'auth',
      }
  }
}

function humanizeOperationalEntry(
  row: OperationalAuditRow,
  centerNames: Map<string, string>,
): HumanizedAuditEntry {
  const centerKey = row.center_id ? `${row.center_type}:${row.center_id}` : ''
  const centerName = centerNames.get(centerKey) ?? centerLabel(row.center_type)
  const actor = row.actor_label || 'Coordinador'

  if (row.action === 'need_created' || row.action === 'need_updated') {
    return {
      id: row.id,
      message: `${actor} actualizó las necesidades del ${centerName}.`,
      actor,
      centerName,
      icon: Package,
      tone: 'info',
      createdAt: row.created_at,
      source: 'operational',
    }
  }

  if (row.action.startsWith('report_')) {
    const status = row.action.replace('report_', '')
    if (status === 'verified') {
      return {
        id: row.id,
        message: `${actor} del ${centerName} validó un reporte ciudadano.`,
        actor,
        centerName,
        icon: CheckCircle2,
        tone: 'success',
        createdAt: row.created_at,
        source: 'operational',
      }
    }
    return {
      id: row.id,
      message: `${actor} del ${centerName} revisó un reporte ciudadano.`,
      actor,
      centerName,
      icon: ShieldCheck,
      tone: 'warning',
      createdAt: row.created_at,
      source: 'operational',
    }
  }

  if (row.action === 'center_created' || row.action === 'site_created') {
    const typeLabel =
      row.center_type === 'hospital'
        ? 'hospital'
        : row.center_type === 'shelter'
          ? 'refugio'
          : row.center_type === 'supply_center'
            ? 'centro de acopio'
            : 'centro'
    return {
      id: row.id,
      message: `Se creó un nuevo ${typeLabel}.`,
      actor,
      centerName,
      icon: Building2,
      tone: 'success',
      createdAt: row.created_at,
      source: 'operational',
    }
  }

  if (row.action === 'center_updated' || row.action === 'center_status_updated') {
    return {
      id: row.id,
      message: `${centerName} actualizó su información operativa.`,
      actor,
      centerName,
      icon: Building2,
      tone: 'info',
      createdAt: row.created_at,
      source: 'operational',
    }
  }

  if (
    row.action === 'donation_arrival' ||
    row.new_value?.toLowerCase().includes('llegada') ||
    row.metadata?.mode === 'arrival'
  ) {
    return {
      id: row.id,
      message: `El Coordinador del ${centerName} registró una nueva donación.`,
      actor,
      centerName,
      icon: Package,
      tone: 'success',
      createdAt: row.created_at,
      source: 'operational',
    }
  }

  return {
    id: row.id,
    message: `${centerName} registró una actualización operativa.`,
    actor,
    centerName,
    icon: Building2,
    tone: 'neutral',
    createdAt: row.created_at,
    source: 'operational',
  }
}

export function humanizeAuditTimeline(input: {
  authLogs: AuthAuditRow[]
  operationalLogs: OperationalAuditRow[]
  centerNames: Map<string, string>
  profilesById: Map<string, string>
}): HumanizedAuditEntry[] {
  const auth = input.authLogs.map((row) => humanizeAuthEntry(row, input.profilesById))
  const operational = input.operationalLogs.map((row) =>
    humanizeOperationalEntry(row, input.centerNames),
  )

  return [...auth, ...operational].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
