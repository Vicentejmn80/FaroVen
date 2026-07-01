import type { CoordinatorSiteType, Need } from '@/lib/types'

export type ActionId = 'receive' | 'saturate' | 'need' | 'persons'

export interface TriageAction {
  id: ActionId
  icon: string
  label: string
  desc: string
}

export const ROLE_ACTIONS: Record<CoordinatorSiteType, TriageAction[]> = {
  supply_center: [
    { id: 'receive', icon: '📥', label: 'Recibí donaciones', desc: 'Actualizar inventario' },
    { id: 'saturate', icon: '🚫', label: 'Ya no aceptamos', desc: 'Publicar excedentes' },
    { id: 'need', icon: '🆘', label: 'Necesitamos', desc: 'Publicar urgencia' },
  ],
  shelter: [
    { id: 'persons', icon: '👥', label: 'Registrar personas', desc: 'Actualizar censo' },
    { id: 'receive', icon: '📥', label: 'Recibí insumos', desc: 'Actualizar stock' },
    { id: 'need', icon: '🆘', label: 'Necesitamos', desc: 'Publicar urgencia' },
  ],
  hospital: [
    { id: 'need', icon: '🚨', label: 'Alerta suministros', desc: 'Publicar crítico' },
    { id: 'receive', icon: '📥', label: 'Ingresó inventario', desc: 'Confirmar stock' },
    { id: 'persons', icon: '👥', label: 'Registrar pacientes', desc: 'Actualizar censo' },
  ],
}

export const SITE_LABELS: Record<CoordinatorSiteType, string> = {
  supply_center: 'Centro de acopio',
  shelter: 'Refugio',
  hospital: 'Hospital',
}

export type TriageLevel = 'critical' | 'high' | 'ok' | 'empty'

export interface TriageStatus {
  level: TriageLevel
  headline: string
  detail: string
  pct: number
}

export function computeStatus(needs: Need[], notAccepts: string[] | undefined): TriageStatus {
  if (!needs.length) {
    return {
      level: 'empty',
      headline: 'Sin datos todavía',
      detail: 'Publica una necesidad para empezar.',
      pct: 0,
    }
  }

  const withQty = needs.filter((n) => n.qty_required > 0)
  const covered = withQty.filter((n) => n.qty_received >= n.qty_required).length
  const pct = withQty.length > 0 ? Math.round((covered / withQty.length) * 100) : 0

  const criticals = needs.filter((n) => n.priority === 'critical')
  const highs = needs.filter((n) => n.priority === 'high')

  if (criticals.length > 0) {
    return {
      level: 'critical',
      headline: `${criticals.length} necesidad${criticals.length > 1 ? 'es' : ''} crítica${criticals.length > 1 ? 's' : ''}`,
      detail: criticals.map((n) => n.item_name).slice(0, 3).join(', '),
      pct,
    }
  }
  if (highs.length > 0) {
    return {
      level: 'high',
      headline: `${highs.length} necesidad${highs.length > 1 ? 'es' : ''} urgente${highs.length > 1 ? 's' : ''}`,
      detail: highs.map((n) => n.item_name).slice(0, 3).join(', '),
      pct,
    }
  }
  if (notAccepts && notAccepts.length > 0) {
    return {
      level: 'high',
      headline: 'Saturación parcial',
      detail: `No aceptamos: ${notAccepts.slice(0, 2).join(', ')}${notAccepts.length > 2 ? '…' : ''}`,
      pct,
    }
  }
  return {
    level: 'ok',
    headline: pct >= 90 ? 'Bien abastecido' : 'Operando con normalidad',
    detail: `${pct}% de necesidades cubiertas`,
    pct,
  }
}

export function sortNeedsByUrgency(needs: Need[]): Need[] {
  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  return [...needs].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
}

export function latestNeed(needs: Need[]): Need | null {
  if (!needs.length) return null
  return [...needs].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )[0]
}
